import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// The contact endpoints send the modification link by email; stub SMTP.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import Fastify, { type FastifyInstance } from "fastify";
import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import { findPendingInvitation } from "../lib/sponsor-invitation.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// Admin management of sponsor contacts (#250): add, list, lock, resend, delete.

let app: FastifyInstance;
let editionId: number;
let sponsorId: number;

describe("Admin sponsor contacts (#250)", () => {
  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(adminSponsorRoutes, { prefix: "/api/admin" });

    const edition = await getSeededEdition();
    editionId = edition.id;

    const sponsor = await createSponsorFixture({
      name: "Admin Contacts Sponsor", slug: `admin-contacts-${Date.now()}`, editionId, tierId: await tierIdByKey("gold"),
    });
    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    if (sponsorId !== undefined) await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
    await app.close();
  });

  beforeEach(() => sendMailMock.mockClear());

  it("adds a contact and invites them to open an account", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsorId}/contacts`,
      payload: { email: "alice@example.org", name: "Alice", role: "Comm" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.email).toBe("alice@example.org");
    // An invitation, not the edit link it replaced (#362).
    expect(body.invitationPending).toBe(true);
    // The first contact runs the space, or nobody can invite the rest.
    expect(body.accessRole).toBe("RESPONSABLE");
    // Neither secret is ever returned to the admin.
    expect(JSON.stringify(body)).not.toContain("invitationToken");
    expect(body).not.toHaveProperty("editToken");
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("lists the sponsor's contacts", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/sponsors/${sponsorId}/contacts` });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((c: { email: string }) => c.email === "alice@example.org")).toBe(true);
  });

  it("deletes a contact", async () => {
    const contact = await prisma.sponsorContact.findFirst({ where: { sponsorId } });
    if (!contact) throw new Error("contact missing");

    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/admin/sponsors/${sponsorId}/contacts/${contact.id}`,
    });
    expect(delRes.statusCode).toBe(204);
    const gone = await prisma.sponsorContact.findUnique({ where: { id: contact.id } });
    expect(gone).toBeNull();
  });

  it("rejects a contact that belongs to another sponsor (404)", async () => {
    const other = await createSponsorFixture({
      name: "Other Sponsor", slug: `other-${Date.now()}`, editionId, tierId: await tierIdByKey("gold"),
    });
    const otherContact = await prisma.sponsorContact.create({
      data: { sponsorId: other.id, email: "x@example.org" },
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/sponsors/${sponsorId}/contacts/${otherContact.id}`,
    });
    expect(res.statusCode).toBe(404);
    await prisma.sponsor.deleteMany({ where: { id: other.id } });
  });
});

describe("POST /api/admin/sponsors/:id/contacts/:contactId/invitation-link (#799)", () => {
  let linkSponsorId: number;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
    const sponsor = await createSponsorFixture({
      name: "Invitation Link Sponsor", slug: `invitation-link-${Date.now()}`, editionId, tierId: await tierIdByKey("gold"),
    });
    linkSponsorId = sponsor.id;
  });

  afterAll(async () => {
    if (linkSponsorId !== undefined) await prisma.sponsor.deleteMany({ where: { id: linkSponsorId } });
    await app.close();
  });

  beforeEach(() => sendMailMock.mockClear());

  it("should return a fresh invitation link without sending any email", async () => {
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: linkSponsorId, email: `link-${Date.now()}@example.org` },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${linkSponsorId}/contacts/${contact.id}/invitation-link`,
    });

    expect(res.statusCode).toBe(200);
    const { url, contact: returned } = res.json();
    const token = url.match(/\/sponsor\/invitation\/([0-9a-f]{64})$/)?.[1];
    expect(token).toBeDefined();
    expect(await findPendingInvitation(token)).toMatchObject({ id: contact.id });
    expect(returned.invitationPending).toBe(true);
    // The first contact invited runs the space (#362), whichever way the link travels.
    expect(returned.accessRole).toBe("RESPONSABLE");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("should stop the previous link from working", async () => {
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: linkSponsorId, email: `rotate-${Date.now()}@example.org` },
    });
    const url = `/api/admin/sponsors/${linkSponsorId}/contacts/${contact.id}/invitation-link`;
    const first = (await app.inject({ method: "POST", url })).json().url.split("/").pop();

    await app.inject({ method: "POST", url });

    expect(await findPendingInvitation(first)).toBeNull();
  });

  it("should refuse a contact that already has an account (409)", async () => {
    const user = await prisma.user.create({
      data: { email: `linked-${Date.now()}@example.org`, name: "Linked", role: "SPONSOR", emailVerified: true },
    });
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: linkSponsorId, email: user.email, userId: user.id },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${linkSponsorId}/contacts/${contact.id}/invitation-link`,
    });

    expect(res.statusCode).toBe(409);
    expect((await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } })).invitationToken).toBeNull();
    await prisma.user.deleteMany({ where: { id: user.id } });
  });
});
