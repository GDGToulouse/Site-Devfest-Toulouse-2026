process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Inviting a colleague sends mail; stub SMTP so no test reaches a real server.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));
import Fastify, { type FastifyInstance } from "fastify";

import sponsorSpaceRoutes from "../routes/sponsor-space.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";

// #362 — who may read what on a sponsor's space. This is authorization code:
// a silent regression here hands one company's private data to another.
//
// Authenticated through the API-key path of getAuthContext rather than a
// better-auth cookie: same resolution, same guard, without having to forge a
// session. The role still comes from the User row, so the check is real.

let app: FastifyInstance;

const created = {
  userIds: [] as string[],
  sponsorIds: [] as number[],
};

// An account plus the bearer token that authenticates it.
async function createAccount(role: "ADMIN" | "EDITOR" | "SPONSOR", email: string) {
  const user = await prisma.user.create({
    data: { email, name: email, role, emailVerified: true },
  });
  created.userIds.push(user.id);

  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { user, bearer: key.raw };
}

async function createSponsor(name: string) {
  const sponsor = await prisma.sponsor.create({
    data: { name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}` },
  });
  created.sponsorIds.push(sponsor.id);
  return sponsor;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });
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

describe("GET /api/sponsor-space/:sponsorId — access by role (#362)", () => {
  it("lets STAND read the public profile but not the private block", async () => {
    const sponsor = await createSponsor("Stand Co");
    const { user, bearer } = await createAccount("SPONSOR", `stand-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "STAND" },
    });

    const auth = { authorization: `Bearer ${bearer}` };
    const profile = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}`, headers: auth });
    const priv = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/private`, headers: auth });
    const team = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/team`, headers: auth });

    expect(profile.statusCode).toBe(200);
    expect(profile.json().accessRole).toBe("STAND");
    // The booth team has no business reading the com kit, nor the colleagues'
    // addresses.
    expect(priv.statusCode).toBe(403);
    expect(team.statusCode).toBe(403);
  });

  it("lets EDITEUR read the private block but not the team", async () => {
    const sponsor = await createSponsor("Editeur Co");
    const { user, bearer } = await createAccount("SPONSOR", `editeur-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
    });

    const auth = { authorization: `Bearer ${bearer}` };
    const priv = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/private`, headers: auth });
    const team = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/team`, headers: auth });

    expect(priv.statusCode).toBe(200);
    // Inviting is the RESPONSABLE's job, so the team list stays out of reach.
    expect(team.statusCode).toBe(403);
  });

  it("lets RESPONSABLE read everything, tokens excluded", async () => {
    const sponsor = await createSponsor("Responsable Co");
    const { user, bearer } = await createAccount("SPONSOR", `resp-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: {
        sponsorId: sponsor.id,
        email: user.email,
        userId: user.id,
        accessRole: "RESPONSABLE",
        invitationToken: `tok-${Date.now()}`,
        invitationSentAt: new Date(),
      },
    });

    const auth = { authorization: `Bearer ${bearer}` };
    const team = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/team`, headers: auth });

    expect(team.statusCode).toBe(200);
    const body = team.json();
    expect(body).toHaveLength(1);
    expect(body[0].accessRole).toBe("RESPONSABLE");
    // A pending invitation is reported as a boolean; the secret never leaves.
    expect(JSON.stringify(body)).not.toContain("tok-");
  });
});

describe("requireSponsorAccess — isolation between companies (#362)", () => {
  it("answers 404 for a sponsor this account has no contact on", async () => {
    const mine = await createSponsor("Mine Co");
    const theirs = await createSponsor("Theirs Co");
    const { user, bearer } = await createAccount("SPONSOR", `outsider-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: mine.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${theirs.id}`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    // 404 and not 403: a stranger probing ids must not learn which exist.
    expect(res.statusCode).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const sponsor = await createSponsor("Anon Co");
    const res = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}` });
    expect(res.statusCode).toBe(401);
  });

  it("refuses an authenticated account with no contact at all", async () => {
    const sponsor = await createSponsor("Nobody Co");
    const { bearer } = await createAccount("SPONSOR", `nobody-${Date.now()}@example.org`);

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("stops granting access once the company is trashed", async () => {
    const sponsor = await createSponsor("Trashed Co");
    const { user, bearer } = await createAccount("SPONSOR", `trashed-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
    });
    await prisma.sponsor.update({ where: { id: sponsor.id }, data: { deletedAt: new Date() } });

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("lets an ADMIN in for support, without giving them a contact", async () => {
    const sponsor = await createSponsor("Supported Co");
    const { bearer } = await createAccount("ADMIN", `admin-${Date.now()}@example.org`);

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}/team`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(200);
    // The override must not appear as a member of the company's own team.
    expect(res.json()).toEqual([]);
  });

  it("keeps a back-office EDITOR out — the back-office role grants nothing here", async () => {
    const sponsor = await createSponsor("Editor Role Co");
    const { bearer } = await createAccount("EDITOR", `boeditor-${Date.now()}@example.org`);

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers: { authorization: `Bearer ${bearer}` },
    });
    // Only ADMIN gets the support override; EDITOR has no business here.
    expect(res.statusCode).toBe(404);
  });
});

describe("PUT /api/sponsor-space/:sponsorId — writing (#362)", () => {
  it("lets EDITEUR save the company's own fields", async () => {
    const sponsor = await createSponsor("Writer Co");
    const { user, bearer } = await createAccount("SPONSOR", `writer-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers: { authorization: `Bearer ${bearer}` },
      payload: { descriptionFr: "Nouvelle description", websiteUrl: "https://example.org" },
    });

    expect(res.statusCode).toBe(200);
    const after = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } });
    expect(after.descriptionFr).toContain("Nouvelle description");
    expect(after.websiteUrl).toBe("https://example.org");
  });

  it("refuses a write from STAND", async () => {
    const sponsor = await createSponsor("Readonly Co");
    const { user, bearer } = await createAccount("SPONSOR", `readonly-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "STAND" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers: { authorization: `Bearer ${bearer}` },
      payload: { descriptionFr: "Tentative" },
    });

    expect(res.statusCode).toBe(403);
    const after = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } });
    expect(after.descriptionFr).toBeNull();
  });

  it("rejects a javascript: URL", async () => {
    const sponsor = await createSponsor("Unsafe Co");
    const { user, bearer } = await createAccount("SPONSOR", `unsafe-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers: { authorization: `Bearer ${bearer}` },
      // Rendered on the public page, so the same http(s) allow-list as the
      // edit link applies (#223).
      payload: { websiteUrl: "javascript:alert(1)" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("unsafe_url");
  });

  it("rejects an unknown field rather than silently dropping it", async () => {
    const sponsor = await createSponsor("Strict Co");
    const { user, bearer } = await createAccount("SPONSOR", `strict-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers: { authorization: `Bearer ${bearer}` },
      // `name` belongs to the organisers: a sponsor renaming its own company
      // would break the slug and the public page.
      payload: { name: "Renamed by me" },
    });

    expect(res.statusCode).toBe(400);
    const after = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } });
    expect(after.name).toBe("Strict Co");
  });
});

describe("Team management from the space (#362)", () => {
  // Inviting sends mail; the transport is stubbed at the top of this file's
  // sibling admin test. Here we only exercise the paths that stop before it.
  it("refuses team management to EDITEUR", async () => {
    const sponsor = await createSponsor("No Invite Co");
    const { user, bearer } = await createAccount("SPONSOR", `noinvite-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
    });

    const auth = { authorization: `Bearer ${bearer}` };
    const invite = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsor.id}/team`,
      headers: auth,
      payload: { email: "someone@example.org" },
    });

    // Inviting is exactly what separates EDITEUR from RESPONSABLE.
    expect(invite.statusCode).toBe(403);
  });

  it("lets RESPONSABLE invite a colleague at a chosen role", async () => {
    const sponsor = await createSponsor("Inviting Co");
    const { user, bearer } = await createAccount("SPONSOR", `inviter-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
    });
    sendMailMock.mockClear();

    const invited = `colleague-${Date.now()}@example.org`;
    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsor.id}/team`,
      headers: { authorization: `Bearer ${bearer}` },
      payload: { email: invited, name: "Colleague", accessRole: "STAND" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessRole).toBe("STAND");
    expect(body.hasAccount).toBe(false);
    // The invitation token stays server-side, like every other secret here.
    expect(JSON.stringify(body)).not.toContain("invitationToken");
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const stored = await prisma.sponsorContact.findFirstOrThrow({
      where: { sponsorId: sponsor.id, email: invited },
    });
    expect(stored.invitationToken).toBeTruthy();
  });

  it("refuses an address already on the team", async () => {
    const sponsor = await createSponsor("Dup Team Co");
    const { user, bearer } = await createAccount("SPONSOR", `dupteam-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsor.id}/team`,
      headers: { authorization: `Bearer ${bearer}` },
      // Same address, different casing: a second row would give the same person
      // two roles with no way to tell which applies.
      payload: { email: user.email.toUpperCase() },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("already_on_team");
  });

  it("refuses to remove the last RESPONSABLE", async () => {
    const sponsor = await createSponsor("Solo Boss Co");
    const { user, bearer } = await createAccount("SPONSOR", `soloboss-${Date.now()}@example.org`);
    const contact = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
    });

    const auth = { authorization: `Bearer ${bearer}` };
    const demote = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}/team/${contact.id}`,
      headers: auth,
      payload: { accessRole: "EDITEUR" },
    });
    const remove = await app.inject({
      method: "DELETE",
      url: `/api/sponsor-space/${sponsor.id}/team/${contact.id}`,
      headers: auth,
    });

    // Either move would leave the space with nobody able to invite anyone back.
    expect(demote.statusCode).toBe(409);
    expect(remove.statusCode).toBe(409);
    expect(await prisma.sponsorContact.count({ where: { id: contact.id } })).toBe(1);
  });

  it("allows removing a RESPONSABLE when another remains", async () => {
    const sponsor = await createSponsor("Two Boss Co");
    const { user, bearer } = await createAccount("SPONSOR", `twoboss-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
    });
    const second = await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: `second-${Date.now()}@example.org`, accessRole: "RESPONSABLE" },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/sponsor-space/${sponsor.id}/team/${second.id}`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(204);
    expect(await prisma.sponsorContact.count({ where: { id: second.id } })).toBe(0);
  });

  it("refuses to touch a contact belonging to another company", async () => {
    const mine = await createSponsor("My Team Co");
    const theirs = await createSponsor("Their Team Co");
    const { user, bearer } = await createAccount("SPONSOR", `crossteam-${Date.now()}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: mine.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
    });
    const foreign = await prisma.sponsorContact.create({
      data: { sponsorId: theirs.id, email: `foreign-${Date.now()}@example.org`, accessRole: "EDITEUR" },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/sponsor-space/${mine.id}/team/${foreign.id}`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(404);
    expect(await prisma.sponsorContact.count({ where: { id: foreign.id } })).toBe(1);
  });
});

describe("GET /api/sponsor-space/mine (#362)", () => {
  it("lists only the companies this account may act on", async () => {
    const a = await createSponsor("Listed A");
    const b = await createSponsor("Listed B");
    await createSponsor("Unlisted C");
    const { user, bearer } = await createAccount("SPONSOR", `mine-${Date.now()}@example.org`);
    await prisma.sponsorContact.createMany({
      data: [
        { sponsorId: a.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
        { sponsorId: b.id, email: user.email, userId: user.id, accessRole: "STAND" },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/sponsor-space/mine",
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(200);
    const slugs = res.json().map((s: { id: number; accessRole: string }) => `${s.id}:${s.accessRole}`);
    expect(slugs).toHaveLength(2);
    // The same person can hold a different role at each company (#362).
    expect(slugs).toContain(`${a.id}:RESPONSABLE`);
    expect(slugs).toContain(`${b.id}:STAND`);
  });
});
