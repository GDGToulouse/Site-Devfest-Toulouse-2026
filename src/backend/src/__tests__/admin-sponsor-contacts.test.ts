import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// The contact endpoints send the modification link by email; stub SMTP.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import Fastify, { type FastifyInstance } from "fastify";
import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

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

    const sponsor = await prisma.sponsor.create({
      data: { name: "Admin Contacts Sponsor", slug: `admin-contacts-${Date.now()}`, editionId, tierId: await tierIdByKey("gold") },
    });
    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
    await app.close();
  });

  beforeEach(() => sendMailMock.mockClear());

  it("adds a contact and emails its link", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsorId}/contacts`,
      payload: { email: "alice@example.org", name: "Alice", role: "Comm" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.email).toBe("alice@example.org");
    expect(body.hasLink).toBe(true);
    // The raw token is never returned to the admin.
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

  it("locks then deletes a contact", async () => {
    const contact = await prisma.sponsorContact.findFirst({ where: { sponsorId } });
    if (!contact) throw new Error("contact missing");

    const lockRes = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsors/${sponsorId}/contacts/${contact.id}/lock`,
      payload: { locked: true },
    });
    expect(lockRes.statusCode).toBe(200);
    expect(lockRes.json().editLinkLocked).toBe(true);

    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/admin/sponsors/${sponsorId}/contacts/${contact.id}`,
    });
    expect(delRes.statusCode).toBe(204);
    const gone = await prisma.sponsorContact.findUnique({ where: { id: contact.id } });
    expect(gone).toBeNull();
  });

  it("rejects a contact that belongs to another sponsor (404)", async () => {
    const other = await prisma.sponsor.create({
      data: { name: "Other Sponsor", slug: `other-${Date.now()}`, editionId, tierId: await tierIdByKey("gold") },
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
