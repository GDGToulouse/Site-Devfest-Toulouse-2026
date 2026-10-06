process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import editRoutes from "../routes/edit.js";
import adminImportRoutes from "../routes/admin/import.js";
import maintenanceRoutes from "../routes/maintenance.js";
import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { requireAdmin } from "../lib/admin-guard.js";
import { requireSponsorAccess } from "../lib/sponsor-guard.js";
import {
  getRequestContext,
  registerRequestContext,
  runInContext,
  systemContext,
  type RequestContext,
} from "../lib/request-context.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #513 — every write must know who made it and through which door. This file
// proves the context before anything writes from it: each entry point resolves
// the right actor and channel, inside the handler and after a parsed body.

const PASSWORD = "context-test-1234!";

let app: FastifyInstance;
// What the context held once the handler had run, per request — read from a
// hook rather than the response, so real routes can be probed unchanged.
const seen = new Map<string, RequestContext | undefined>();

const created = { userIds: [] as string[], sponsorIds: [] as number[], speakerIds: [] as number[] };
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createUser(role: "ADMIN" | "EDITOR" | "SPONSOR", name: string) {
  const email = `context-${role.toLowerCase()}-${stamp()}@example.org`;
  const user = await prisma.user.create({ data: { email, name, role, emailVerified: true } });
  created.userIds.push(user.id);
  return user;
}

async function sessionCookie(userId: string, email: string) {
  const ctx = await auth.$context;
  await prisma.account.create({
    data: { userId, accountId: userId, providerId: "credential", password: await ctx.password.hash(PASSWORD) },
  });
  const { headers } = await auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
  const setCookie = headers.get("set-cookie") ?? "";
  return setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
}

async function apiKeyFor(userId: string) {
  const key = await generateApiKey(resolveApiKeyEnv());
  const row = await prisma.apiKey.create({
    data: { name: "context-test", prefix: key.prefix, hashedKey: key.hashedKey, userId },
  });
  return { bearer: key.raw, id: row.id };
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("adminUser");
  registerRequestContext(app);
  app.addHook("onSend", async (request, reply) => {
    seen.set(request.id, getRequestContext());
    reply.header("x-test-request", request.id);
  });

  // Probes stand in for any route of their area: they return what the handler
  // sees, behind the same guards the real routes use.
  app.post("/api/admin/probe", { preHandler: requireAdmin }, async () => getRequestContext() ?? null);
  app.post(
    "/api/sponsor-space/:sponsorId/probe",
    { preHandler: requireSponsorAccess("STAND") },
    async () => getRequestContext() ?? null,
  );
  app.post("/api/probe", async () => getRequestContext() ?? null);

  await app.register(editRoutes, { prefix: "/api" });
  await app.register(maintenanceRoutes, { prefix: "/api" });
  await app.register(
    async (admin) => {
      admin.addHook("preHandler", requireAdmin);
      await admin.register(adminImportRoutes);
    },
    { prefix: "/api/admin" },
  );
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (created.sponsorIds.length) await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  if (created.speakerIds.length) await prisma.speaker.deleteMany({ where: { id: { in: created.speakerIds } } });
  if (created.userIds.length) await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
});

describe("request context (#513)", () => {
  it("should attribute an admin session to the user on the ADMIN channel", async () => {
    const user = await createUser("ADMIN", "Ada Admin");
    const cookie = await sessionCookie(user.id, user.email);

    const res = await app.inject({ method: "POST", url: "/api/admin/probe", headers: { cookie }, payload: { x: 1 } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ channel: "ADMIN", actor: { userId: user.id, label: "Ada Admin" } });
  });

  it("should file an API key call on the API_KEY channel with the key id", async () => {
    const user = await createUser("EDITOR", "Eddie Editor");
    const key = await apiKeyFor(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/probe",
      headers: { authorization: `Bearer ${key.bearer}` },
      payload: { x: 1 },
    });

    expect(res.json()).toMatchObject({
      channel: "API_KEY",
      apiKeyId: key.id,
      actor: { userId: user.id, label: "Eddie Editor" },
    });
  });

  it("should attribute a sponsor session to the user on the SPONSOR channel", async () => {
    const user = await createUser("SPONSOR", "Sam Sponsor");
    const sponsor = await prisma.sponsor.create({ data: { name: `Context Co ${stamp()}`, slug: `context-co-${stamp()}` } });
    created.sponsorIds.push(sponsor.id);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
    });
    const cookie = await sessionCookie(user.id, user.email);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsor.id}/probe`,
      headers: { cookie },
      payload: { x: 1 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ channel: "SPONSOR", actor: { userId: user.id, label: "Sam Sponsor" } });
  });

  it("should attribute an edit link to the speaker holding it, without an account", async () => {
    const speaker = await prisma.speaker.create({
      data: { name: "Lin Link", slug: `lin-link-${stamp()}`, editToken: `ctx-${stamp()}` },
    });
    created.speakerIds.push(speaker.id);

    const res = await app.inject({ method: "GET", url: `/api/edit/${speaker.editToken}` });

    expect(res.statusCode).toBe(200);
    expect(seen.get(String(res.headers["x-test-request"]))).toMatchObject({
      channel: "EDIT_LINK",
      actor: { userId: null, label: `Lin Link (speaker #${speaker.id})` },
    });
  });

  it("should file a Sessionize import on the IMPORT channel, still attributed to the admin", async () => {
    const user = await createUser("ADMIN", "Ivy Importer");
    const cookie = await sessionCookie(user.id, user.email);
    const edition = await getSeededEdition();

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/sessionize",
      headers: { cookie },
      payload: { editionId: edition.id, json: JSON.stringify({ sessions: [], speakers: [] }) },
    });

    expect(res.statusCode).toBe(200);
    expect(seen.get(String(res.headers["x-test-request"]))).toMatchObject({ channel: "IMPORT", actor: { userId: user.id } });
  });

  it("should keep the context through a body read from a real socket", async () => {
    // inject() hands the body over in one go and never leaves the async
    // context; a real connection streams it, which is what can lose the store.
    const user = await createUser("EDITOR", "Sol Socket");
    const key = await apiKeyFor(user.id);
    const address = await app.listen({ port: 0, host: "127.0.0.1" });

    const res = await fetch(`${address}/api/admin/probe`, {
      method: "POST",
      headers: { authorization: `Bearer ${key.bearer}`, "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(200_000) }),
    });

    expect(await res.json()).toMatchObject({ channel: "API_KEY", actor: { userId: user.id } });
  });

  it("should leave an anonymous public call on the PUBLIC channel with no actor", async () => {
    const res = await app.inject({ method: "POST", url: "/api/probe", payload: { x: 1 } });

    expect(res.json()).toMatchObject({ channel: "PUBLIC" });
    expect(res.json().actor).toBeUndefined();
  });

  it("should file a manual purge on the ADMIN channel, not as the cron", async () => {
    const user = await createUser("ADMIN", "Pat Purger");
    const cookie = await sessionCookie(user.id, user.email);

    const res = await app.inject({ method: "GET", url: "/api/maintenance/purge-trash", headers: { cookie } });

    expect(res.statusCode).toBe(200);
    expect(seen.get(String(res.headers["x-test-request"]))).toMatchObject({ channel: "ADMIN", actor: { userId: user.id } });
  });

  it("should run scheduled work in a named SYSTEM context", async () => {
    const context = await runInContext(systemContext("Rotation"), async () => getRequestContext());

    expect(context).toEqual({ channel: "SYSTEM", actor: { userId: null, label: "Rotation" } });
  });
});
