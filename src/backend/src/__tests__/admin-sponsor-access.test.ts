import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Inviting sends an email; stub SMTP so the tests never reach a real server.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import Fastify, { type FastifyInstance } from "fastify";

import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";

// #362 — the organiser side: invite a contact to open an account, and set what
// they may do. Mounted without the auth guards, like the other admin-* files:
// auth-rejection.test.ts covers the guards themselves.

let app: FastifyInstance;
const createdSponsorIds: number[] = [];

async function createSponsor(name: string) {
  const sponsor = await prisma.sponsor.create({
    data: { name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}` },
  });
  createdSponsorIds.push(sponsor.id);
  return sponsor;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
  await app.ready();
});

beforeEach(() => {
  sendMailMock.mockClear();
});

afterAll(async () => {
  await app.close();
  if (createdSponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
  }
});

describe("POST /api/admin/sponsors/:id/contacts/:contactId/invite (#362)", () => {
  it("sends the invitation and records it without returning the token", async () => {
    const sponsor = await createSponsor("Invite Co");
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "boss@example.org" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/contacts/${contact.id}/invite`,
      payload: { accessRole: "RESPONSABLE" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessRole).toBe("RESPONSABLE");
    expect(body.invitationPending).toBe(true);
    expect(body.hasAccount).toBe(false);
    // The secret stays server-side, like the edit token before it.
    expect(JSON.stringify(body)).not.toContain("invitationToken");

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const stored = await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(stored.invitationToken).toBeTruthy();
    expect(stored.invitationSentAt).not.toBeNull();
  });

  it("rotates the token on re-invite, invalidating the previous one", async () => {
    const sponsor = await createSponsor("Reinvite Co");
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "again@example.org" },
    });

    const url = `/api/admin/sponsors/${sponsor.id}/contacts/${contact.id}/invite`;
    await app.inject({ method: "POST", url, payload: {} });
    const first = await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } });
    await app.inject({ method: "POST", url, payload: {} });
    const second = await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } });

    // The column is @unique so the rotation overwrites, but the behaviour is
    // deliberate: an invitation left in an old mailbox must stop working.
    expect(second.invitationToken).not.toBe(first.invitationToken);
  });

  it("refuses to invite a contact that already has an account", async () => {
    const sponsor = await createSponsor("Bound Co");
    const user = await prisma.user.create({
      data: { email: `bound-${Date.now()}@example.org`, role: "SPONSOR" },
    });
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/contacts/${contact.id}/invite`,
      payload: {},
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("already_has_account");
    expect(sendMailMock).not.toHaveBeenCalled();

    await prisma.sponsorContact.delete({ where: { id: contact.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("rejects an unknown access role", async () => {
    const sponsor = await createSponsor("Bad Role Co");
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "bad@example.org" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/contacts/${contact.id}/invite`,
      payload: { accessRole: "SUPERADMIN" },
    });

    expect(res.statusCode).toBe(422);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("refuses a contact belonging to another sponsor", async () => {
    const mine = await createSponsor("Mine Invite Co");
    const theirs = await createSponsor("Theirs Invite Co");
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: theirs.id, email: "other@example.org" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${mine.id}/contacts/${contact.id}/invite`,
      payload: {},
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PUT /api/admin/sponsors/:id/contacts/:contactId/access-role (#362)", () => {
  it("changes the role", async () => {
    const sponsor = await createSponsor("Promote Co");
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "promote@example.org", accessRole: "STAND" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsors/${sponsor.id}/contacts/${contact.id}/access-role`,
      payload: { accessRole: "EDITEUR" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().accessRole).toBe("EDITEUR");
  });

  it("refuses to demote the last RESPONSABLE", async () => {
    const sponsor = await createSponsor("Last Resp Co");
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "onlyboss@example.org", accessRole: "RESPONSABLE" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsors/${sponsor.id}/contacts/${contact.id}/access-role`,
      payload: { accessRole: "EDITEUR" },
    });

    // Otherwise the company keeps its space but nobody can invite anyone into
    // it — only an admin could unblock the situation.
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("last_responsable");
    const after = await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(after.accessRole).toBe("RESPONSABLE");
  });

  it("allows demoting a RESPONSABLE when another one remains", async () => {
    const sponsor = await createSponsor("Two Resp Co");
    const first = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "boss1@example.org", accessRole: "RESPONSABLE" },
    });
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "boss2@example.org", accessRole: "RESPONSABLE" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsors/${sponsor.id}/contacts/${first.id}/access-role`,
      payload: { accessRole: "STAND" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().accessRole).toBe("STAND");
  });

  it("rejects an unknown role", async () => {
    const sponsor = await createSponsor("Bad Change Co");
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: "badchange@example.org", accessRole: "STAND" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsors/${sponsor.id}/contacts/${contact.id}/access-role`,
      payload: { accessRole: "OWNER" },
    });

    expect(res.statusCode).toBe(422);
  });
});
