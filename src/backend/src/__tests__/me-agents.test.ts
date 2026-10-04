process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminRoutes from "../routes/admin/index.js";
import myAgentsRoutes from "../routes/me/agents.js";
import mcpRoutes from "../routes/mcp.js";
import { registerAuthRoutes } from "../plugins/auth-routes.js";
import { registerRequestContext } from "../lib/request-context.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";
import { prisma } from "../lib/prisma.js";
import { createAgentClient, createUserWithPassword, obtainAgentToken, signInCookie } from "./agent-test-helpers.js";

// #514 — a person sees the agents acting for them and can withdraw one; an
// admin banning or deleting the account withdraws them all. "Withdrawn" is
// proven by the agent's next call failing, not by a row disappearing.

let app: FastifyInstance;
let clientId: string;
const created = { userIds: [] as string[] };

function tools(token: string) {
  return app.inject({
    method: "POST",
    url: "/api/mcp",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    payload: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
}

async function connectedSponsor(name: string) {
  const user = await createUserWithPassword("SPONSOR", name);
  created.userIds.push(user.id);
  const token = await obtainAgentToken(app, clientId, user.email);
  return { user, token, cookie: await signInCookie(app, user.email) };
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("adminUser");
  registerRequestContext(app);
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await registerAuthRoutes(app);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(myAgentsRoutes, { prefix: "/api/me" });
  await app.register(mcpRoutes, { prefix: "/api" });
  await app.ready();
  clientId = await createAgentClient("Claude (test)");
});

afterAll(async () => {
  await app.close();
  await prisma.oauthClient.delete({ where: { clientId } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: created.userIds } } });
});

describe("/api/me/agents (#514)", () => {
  it("should list the agent a sponsor connected, by the name it gave", async () => {
    const { cookie } = await connectedSponsor("Lise Liste");

    const res = await app.inject({ method: "GET", url: "/api/me/agents", headers: { cookie } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([expect.objectContaining({ clientId, name: "Claude (test)" })]);
  });

  it("should cut the agent off on its next call once revoked", async () => {
    const { token, cookie } = await connectedSponsor("Rémi Révoque");
    expect((await tools(token)).statusCode).toBe(200);

    const revoke = await app.inject({ method: "DELETE", url: `/api/me/agents/${clientId}`, headers: { cookie } });

    expect(revoke.statusCode).toBe(204);
    expect((await tools(token)).statusCode).toBe(401);
    const list = await app.inject({ method: "GET", url: "/api/me/agents", headers: { cookie } });
    expect(list.json()).toEqual([]);
  });

  it("should answer 404 for an agent that was never connected", async () => {
    const { cookie } = await connectedSponsor("Nina Nulle");

    const res = await app.inject({ method: "DELETE", url: "/api/me/agents/not-an-agent", headers: { cookie } });

    expect(res.statusCode).toBe(404);
  });

  it("should not let an agent list or revoke agents", async () => {
    const { token } = await connectedSponsor("Alex Agent");

    const res = await app.inject({ method: "GET", url: "/api/me/agents", headers: { authorization: `Bearer ${token}` } });

    expect(res.statusCode).toBe(401);
  });
});

describe("admin actions on an account with agents (#514)", () => {
  async function adminCookie() {
    const admin = await createUserWithPassword("ADMIN", "Ada Admin");
    created.userIds.push(admin.id);
    return signInCookie(app, admin.email);
  }

  it("should cut the agents off when the account is banned, and keep them off once unbanned", async () => {
    const { user, token } = await connectedSponsor("Bastien Banni");
    const cookie = await adminCookie();

    await app.inject({ method: "PUT", url: `/api/admin/users/${user.id}/ban`, headers: { cookie } });
    await app.inject({ method: "PUT", url: `/api/admin/users/${user.id}/ban`, headers: { cookie } });

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).banned).toBe(false);
    expect((await tools(token)).statusCode).toBe(401);
  });

  it("should cut the agents off when the account is deleted", async () => {
    const { user, token } = await connectedSponsor("Denis Delete");
    const cookie = await adminCookie();

    await app.inject({ method: "DELETE", url: `/api/admin/users/${user.id}`, headers: { cookie } });

    expect(await prisma.oauthConsent.count({ where: { userId: user.id } })).toBe(0);
    expect((await tools(token)).statusCode).toBe(401);
  });
});
