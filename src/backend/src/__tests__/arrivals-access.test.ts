process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// No SMTP in tests: the invitation mail is recorded, and fails on demand.
const sentTo: string[] = [];
const failingAddresses = new Set<string>();
vi.mock("../lib/arrivals-invitation-email.js", () => ({
  sendArrivalsInvitationEmail: vi.fn(async ({ to }: { to: string }) => {
    if (failingAddresses.has(to)) throw new Error("SMTP down");
    sentTo.push(to);
  }),
}));

import arrivalsRoutes from "../routes/arrivals.js";
import adminArrivalsAccessRoutes from "../routes/admin/arrivals-access.js";
import { requireAdmin, requireAdminRole } from "../lib/admin-guard.js";
import { canAccessArrivals, hasPendingArrivalsInvitation } from "../lib/arrivals-access.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { INVITATION_TTL_DAYS } from "../lib/edit-token.js";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

// Volunteer accounts and the per-edition arrivals permission (#640). This file
// owns the edition years 1644 and 1645.
const YEAR = 1644;
const OTHER_YEAR = 1645;

let app: FastifyInstance;
let editionId: number;
let otherEditionId: number;
const userIds: string[] = [];
let stamp = 0;
const uniqueEmail = (label: string) => `${label}-${Date.now()}-${stamp++}@example.org`;

async function createAccount(email: string, role: "ADMIN" | "EDITOR" | "SPONSOR" | "GUEST", emailVerified = true) {
  const user = await prisma.user.create({ data: { email, name: email, role, emailVerified } });
  userIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { user, bearer: key.raw };
}

async function invitation(email: string, sentAt = new Date(), onEdition = () => editionId) {
  const token = `arr-${Date.now()}-${stamp++}`;
  await prisma.arrivalsAccess.create({
    data: { editionId: onEdition(), email, invitationToken: token, invitationSentAt: sentAt },
  });
  return token;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  await app.register(arrivalsRoutes, { prefix: "/api" });
  await app.register(adminArrivalsAccessRoutes, { prefix: "/api/admin" });
  // Stand-ins for the back-office groups, to probe the two guards with a GUEST.
  await app.register(async (team) => {
    team.addHook("preHandler", requireAdmin);
    team.get("/api/admin/probe-team", async () => ({ ok: true }));
  });
  await app.register(async (admins) => {
    admins.addHook("preHandler", requireAdminRole);
    admins.get("/api/admin/probe-admin", async () => ({ ok: true }));
  });
  await app.ready();
  editionId = (await prisma.edition.create({ data: { year: YEAR } })).id;
  otherEditionId = (await prisma.edition.create({ data: { year: OTHER_YEAR } })).id;
});

afterAll(async () => {
  await app.close();
  if (editionId !== undefined) await prisma.edition.deleteMany({ where: { id: { in: [editionId, otherEditionId] } } });
  const invited = await prisma.user.findMany({ where: { email: { endsWith: "@example.org" }, role: "GUEST" }, select: { id: true } });
  const ids = [...userIds, ...invited.map((u) => u.id)];
  if (ids.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});

describe("Volunteer sign-up through an invitation (#640)", () => {
  it("should create the account as GUEST, never the EDITOR default, and verified", async () => {
    const email = uniqueEmail("signup");
    const token = await invitation(email);

    const res = await app.inject({
      method: "POST",
      url: `/api/arrivals-invitation/${token}/sign-up`,
      payload: { password: "volunteer1234!test" },
    });

    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userIds.push(user.id);
    // EDITOR here would open the back-office to every volunteer (#362).
    expect(user.role).toBe("GUEST");
    expect(user.emailVerified).toBe(true);
  });

  it("should let an identity provider create the invited account as GUEST", async () => {
    const email = uniqueEmail("oauth");
    await invitation(email);

    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser({ email, name: "Volunteer", emailVerified: true }, undefined as never);
    userIds.push(user.id);

    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).role).toBe("GUEST");
  });

  it("should refuse a plain sign-up on an invited address: the token proves the mailbox", async () => {
    const email = uniqueEmail("presignup");
    await invitation(email);

    await expect(
      auth.api.signUpEmail({ body: { name: "Someone", email, password: "someone1234!test" } }),
    ).rejects.toThrow();
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it("should close the sign-up door once the invitation expires", async () => {
    const email = uniqueEmail("expired");
    const sentAt = new Date(Date.now() - (INVITATION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000);
    const token = await invitation(email, sentAt);

    expect(await hasPendingArrivalsInvitation(email)).toBe(false);
    expect((await app.inject({ method: "GET", url: `/api/arrivals-invitation/${token}` })).statusCode).toBe(404);
  });
});

describe("Accepting a volunteer invitation (#640)", () => {
  it("should grant the signed-in invited account, once, and mark it verified", async () => {
    const email = uniqueEmail("accept");
    const token = await invitation(email);
    const { user, bearer } = await createAccount(email, "GUEST", false);

    const res = await app.inject({
      method: "POST",
      url: `/api/arrivals-invitation/${token}/accept`,
      headers: { authorization: `Bearer ${bearer}` },
    });
    const replay = await app.inject({
      method: "POST",
      url: `/api/arrivals-invitation/${token}/accept`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(200);
    expect(replay.statusCode).toBe(404);
    const access = await prisma.arrivalsAccess.findFirstOrThrow({ where: { editionId, email } });
    expect(access.userId).toBe(user.id);
    expect(access.invitationToken).toBeNull();
    // Unverified, the first magic link would wipe the password (RG-ARR-24).
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(true);
  });

  it("should refuse an account whose address is not the invited one", async () => {
    const token = await invitation(uniqueEmail("invited"));
    const { bearer } = await createAccount(uniqueEmail("stranger"), "GUEST");

    const res = await app.inject({
      method: "POST",
      url: `/api/arrivals-invitation/${token}/accept`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("email_mismatch");
  });
});

describe("Who may open the arrivals (#640)", () => {
  it("should keep a GUEST out of every back-office route", async () => {
    const { bearer } = await createAccount(uniqueEmail("guest"), "GUEST");
    const headers = { authorization: `Bearer ${bearer}` };

    expect((await app.inject({ method: "GET", url: "/api/admin/probe-team", headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/api/admin/probe-admin", headers })).statusCode).toBe(403);
  });

  it("should open an edition to a GUEST holding its permission, and not another edition", async () => {
    const email = uniqueEmail("holder");
    const { user } = await createAccount(email, "GUEST");
    await prisma.arrivalsAccess.create({ data: { editionId, email, userId: user.id } });

    expect(await canAccessArrivals(user, editionId)).toBe(true);
    expect(await canAccessArrivals(user, otherEditionId)).toBe(false);
  });

  it("should keep out a GUEST whose invitation is still pending", async () => {
    const email = uniqueEmail("pending");
    await invitation(email);
    const { user } = await createAccount(email, "GUEST");

    expect(await canAccessArrivals(user, editionId)).toBe(false);
  });

  it("should open every edition to an ADMIN without a permission row", async () => {
    const { user } = await createAccount(uniqueEmail("admin"), "ADMIN");

    expect(await canAccessArrivals(user, otherEditionId)).toBe(true);
  });

  it("should ask an anonymous caller to sign in", async () => {
    expect((await app.inject({ method: "GET", url: "/api/arrivals/current" })).statusCode).toBe(401);
  });
});

describe("Inviting volunteers in a batch (#640)", () => {
  it("should turn 40 pasted addresses into invitations or permissions, and report the rest", async () => {
    const fresh = Array.from({ length: 38 }, (_, i) => uniqueEmail(`batch${i}`));
    const existing = uniqueEmail("existing");
    const { user } = await createAccount(existing, "EDITOR");
    const failing = uniqueEmail("failing");
    failingAddresses.add(failing);
    const pasted = [...fresh, existing.toUpperCase(), failing, fresh[0], "not-an-address"].join("\n");

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/arrivals-access/${editionId}/invite`,
      payload: { emails: pasted },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      invited: fresh,
      granted: [existing],
      failed: [failing],
      duplicates: [fresh[0]],
      invalid: ["not-an-address"],
      alreadyListed: [],
    });
    // The existing account gets the permission without a mail (RG-ARR-23).
    expect(sentTo).not.toContain(existing);
    expect(await canAccessArrivals(user, editionId)).toBe(true);
    // A failed mail leaves no open invitation behind (#223).
    expect(await prisma.arrivalsAccess.count({ where: { editionId, email: failing } })).toBe(0);
  });

  it("should report an address already invited instead of inviting it twice", async () => {
    const email = uniqueEmail("twice");
    await invitation(email);

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/arrivals-access/${editionId}/invite`,
      payload: { emails: email },
    });

    expect(res.json()).toMatchObject({ invited: [], alreadyListed: [email] });
  });

  it("should send a new link on resend, and the old one stops working", async () => {
    const email = uniqueEmail("resend");
    const oldToken = await invitation(email);
    const access = await prisma.arrivalsAccess.findFirstOrThrow({ where: { editionId, email } });

    const res = await app.inject({ method: "POST", url: `/api/admin/arrivals-access/${editionId}/${access.id}/resend` });

    expect(res.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/arrivals-invitation/${oldToken}` })).statusCode).toBe(404);
  });

  it("should withdraw a permission and keep the account", async () => {
    const email = uniqueEmail("withdrawn");
    const { user } = await createAccount(email, "GUEST");
    const access = await prisma.arrivalsAccess.create({ data: { editionId, email, userId: user.id } });

    const res = await app.inject({ method: "DELETE", url: `/api/admin/arrivals-access/${editionId}/${access.id}` });

    expect(res.statusCode).toBe(204);
    expect(await canAccessArrivals(user, editionId)).toBe(false);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });
});
