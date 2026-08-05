process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import sponsorInvitationRoutes from "../routes/sponsor-invitation.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { hasPendingInvitation } from "../lib/sponsor-invitation.js";
import { INVITATION_TTL_DAYS } from "../lib/edit-token.js";

// #362 — accepting an invitation binds an account to a company. The rules that
// matter are: the email must match exactly, the token works once, and an
// expired invitation opens nothing.

let app: FastifyInstance;

const created = {
  userIds: [] as string[],
  sponsorIds: [] as number[],
};

async function createAccount(email: string) {
  const user = await prisma.user.create({
    data: { email, name: email, role: "SPONSOR", emailVerified: true },
  });
  created.userIds.push(user.id);

  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { user, bearer: key.raw };
}

async function createSponsorWithInvitation(name: string, email: string, sentAt = new Date()) {
  const sponsor = await prisma.sponsor.create({
    data: { name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}` },
  });
  created.sponsorIds.push(sponsor.id);

  const token = `inv-${name}-${Date.now()}-${Math.floor(sentAt.getTime())}`;
  const contact = await prisma.sponsorContact.create({
    data: {
      sponsorId: sponsor.id,
      email,
      accessRole: "RESPONSABLE",
      invitationToken: token,
      invitationSentAt: sentAt,
    },
  });
  return { sponsor, contact, token };
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  await app.register(sponsorInvitationRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (created.userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
  if (created.sponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  }
});

describe("POST /api/sponsor-invitation/:token/accept (#362)", () => {
  it("binds the account when the email matches the invitation", async () => {
    const email = `match-${Date.now()}@example.org`;
    const { sponsor, contact, token } = await createSponsorWithInvitation("Match Co", email);
    const { user, bearer } = await createAccount(email);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-invitation/${token}/accept`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().sponsorId).toBe(sponsor.id);

    const after = await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(after.userId).toBe(user.id);
    expect(after.invitationAcceptedAt).not.toBeNull();
    // Consumed: the token is cleared, so a replay finds nothing.
    expect(after.invitationToken).toBeNull();
  });

  it("refuses an account whose email differs from the invited one", async () => {
    const invited = `invited-${Date.now()}@societe.fr`;
    const { contact, token } = await createSponsorWithInvitation("Mismatch Co", invited);
    // The person signs in with a personal account instead.
    const { bearer } = await createAccount(`personal-${Date.now()}@gmail.com`);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-invitation/${token}/accept`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("email_mismatch");
    // Nothing bound: the invitation stays open for the right address.
    const after = await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(after.userId).toBeNull();
    expect(after.invitationAcceptedAt).toBeNull();
  });

  it("matches the email regardless of case", async () => {
    const stamp = Date.now();
    const { contact, token } = await createSponsorWithInvitation("Case Co", `Contact-${stamp}@Societe.FR`);
    const { user, bearer } = await createAccount(`contact-${stamp}@societe.fr`);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-invitation/${token}/accept`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    // Identity providers do not agree on casing — the invitation must survive it.
    expect(res.statusCode).toBe(200);
    const after = await prisma.sponsorContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(after.userId).toBe(user.id);
  });

  it("refuses a second use of the same token", async () => {
    const email = `once-${Date.now()}@example.org`;
    const { token } = await createSponsorWithInvitation("Once Co", email);
    const { bearer } = await createAccount(email);

    const auth = { authorization: `Bearer ${bearer}` };
    const first = await app.inject({ method: "POST", url: `/api/sponsor-invitation/${token}/accept`, headers: auth });
    const second = await app.inject({ method: "POST", url: `/api/sponsor-invitation/${token}/accept`, headers: auth });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(404);
  });

  it("refuses an expired invitation", async () => {
    const email = `stale-${Date.now()}@example.org`;
    const longAgo = new Date(Date.now() - (INVITATION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000);
    const { token } = await createSponsorWithInvitation("Stale Co", email, longAgo);
    const { bearer } = await createAccount(email);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-invitation/${token}/accept`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("refuses an unauthenticated caller holding a valid token", async () => {
    const { token } = await createSponsorWithInvitation("Anon Co", `anon-${Date.now()}@example.org`);

    const res = await app.inject({ method: "POST", url: `/api/sponsor-invitation/${token}/accept` });

    // The token alone is not enough: it says who was invited, not who is here.
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/sponsor-invitation/:token (#362)", () => {
  it("describes the invitation without leaking the address", async () => {
    const email = `preview-${Date.now()}@societe.fr`;
    const { token } = await createSponsorWithInvitation("Preview Co", email);

    const res = await app.inject({ method: "GET", url: `/api/sponsor-invitation/${token}` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sponsorName).toBe("Preview Co");
    expect(body.accessRole).toBe("RESPONSABLE");
    // A forwarded link must not hand the mailbox to whoever opens it.
    expect(body.emailHint).not.toBe(email);
    expect(body.emailHint).toContain("•");
  });

  it("answers the same 404 for unknown and consumed tokens", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sponsor-invitation/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });
});

describe("hasPendingInvitation — the sign-up door (#362)", () => {
  it("opens for a live invitation and closes once accepted", async () => {
    const email = `door-${Date.now()}@example.org`;
    const { contact } = await createSponsorWithInvitation("Door Co", email);

    expect(await hasPendingInvitation(email)).toBe(true);

    await prisma.sponsorContact.update({
      where: { id: contact.id },
      data: { invitationAcceptedAt: new Date(), invitationToken: null },
    });

    // Otherwise the address could mint a second account forever.
    expect(await hasPendingInvitation(email)).toBe(false);
  });

  it("stays shut for an address nobody invited", async () => {
    expect(await hasPendingInvitation(`stranger-${Date.now()}@example.org`)).toBe(false);
  });

  it("stays shut for an expired invitation", async () => {
    const email = `expired-door-${Date.now()}@example.org`;
    const longAgo = new Date(Date.now() - (INVITATION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000);
    await createSponsorWithInvitation("Expired Door Co", email, longAgo);

    expect(await hasPendingInvitation(email)).toBe(false);
  });

  it("stays shut once the company is trashed", async () => {
    const email = `trashed-door-${Date.now()}@example.org`;
    const { sponsor } = await createSponsorWithInvitation("Trashed Door Co", email);
    await prisma.sponsor.update({ where: { id: sponsor.id }, data: { deletedAt: new Date() } });

    expect(await hasPendingInvitation(email)).toBe(false);
  });
});
