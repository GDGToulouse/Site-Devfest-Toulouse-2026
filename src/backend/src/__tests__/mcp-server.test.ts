process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminRoutes from "../routes/admin/index.js";
import sponsorSpaceRoutes from "../routes/sponsor-space.js";
import mcpRoutes from "../routes/mcp.js";
import myApiKeysRoutes from "../routes/me/api-keys.js";
import myAgentsRoutes from "../routes/me/agents.js";
import { registerAuthRoutes } from "../plugins/auth-routes.js";
import { registerRequestContext } from "../lib/request-context.js";
import { registerRouteCatalog } from "../lib/route-catalog.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";
import { prisma } from "../lib/prisma.js";
import { createAgentClient, createUserWithPassword, obtainAgentToken } from "./agent-test-helpers.js";

// #514 — /api/mcp exposes the API to an agent with exactly its person's rights.
// The connector holds no rule of its own: what passes or fails here is the
// API's guards, reached with the agent's token.

let app: FastifyInstance;
let clientId: string;
let adminToken: string;
let sponsorToken: string;
let sponsorUserId: string;
let sponsorId: number;
const created = { userIds: [] as string[] };

async function rpc(token: string | null, method: string, params: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/mcp",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token && { authorization: `Bearer ${token}` }),
    },
    payload: { jsonrpc: "2.0", id: 1, method, params },
  });
}

async function callTool(token: string, name: string, args: Record<string, unknown>) {
  const res = await rpc(token, "tools/call", { name, arguments: args });
  const result = res.json().result;
  const text: string = result.content[0].text;
  // A refusal from the connector itself is a sentence, a route's answer is JSON.
  const data = text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text;
  return { isError: result.isError === true, data };
}

beforeAll(async () => {
  app = Fastify({ logger: false, trustProxy: true });
  app.decorateRequest("adminUser");
  registerRequestContext(app);
  registerRouteCatalog(app);
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await registerAuthRoutes(app);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });
  await app.register(myApiKeysRoutes, { prefix: "/api/me" });
  await app.register(myAgentsRoutes, { prefix: "/api/me" });
  await app.register(mcpRoutes, { prefix: "/api" });
  await app.ready();

  clientId = await createAgentClient();
  const admin = await createUserWithPassword("ADMIN", "Agent Admin");
  const sponsorUser = await createUserWithPassword("SPONSOR", "Agent Sponsor");
  created.userIds.push(admin.id, sponsorUser.id);
  sponsorUserId = sponsorUser.id;
  const sponsor = await prisma.sponsor.create({ data: { name: `MCP Co ${Date.now()}`, slug: `mcp-co-${Date.now()}` } });
  sponsorId = sponsor.id;
  await prisma.sponsorContact.create({
    data: { sponsorId, email: sponsorUser.email, userId: sponsorUser.id, accessRole: "EDITEUR" },
  });

  adminToken = await obtainAgentToken(app, clientId, admin.email);
  sponsorToken = await obtainAgentToken(app, clientId, sponsorUser.email);
});

afterAll(async () => {
  await app.close();
  await prisma.sponsor.delete({ where: { id: sponsorId } });
  await prisma.oauthClient.delete({ where: { clientId } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [String(sponsorId), ...created.userIds] } } });
});

describe("POST /api/mcp — authentication (#514)", () => {
  it("should send an agent without a token to the resource metadata", async () => {
    const res = await rpc(null, "tools/list");

    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("/.well-known/oauth-protected-resource/api/mcp");
  });

  it("should refuse a token that is not one of ours", async () => {
    const forged = `${adminToken.split(".").slice(0, 2).join(".")}.not-the-signature`;

    expect((await rpc(forged, "tools/list")).statusCode).toBe(401);
  });

  it("should offer the two tools", async () => {
    const res = await rpc(adminToken, "tools/list");

    expect(res.statusCode).toBe(200);
    expect(res.json().result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["call_route", "list_routes"]);
  });
});

describe("POST /api/mcp — tools (#514)", () => {
  it("should list the API routes, without the auth and MCP plumbing", async () => {
    const { data } = await callTool(adminToken, "list_routes", {});

    const paths = data.map((r: { method: string; path: string }) => `${r.method} ${r.path}`);
    expect(paths).toContain("GET /api/admin/speakers");
    expect(paths.some((p: string) => p.includes("/api/auth") || p.includes("/api/mcp"))).toBe(false);
  });

  it("should let an admin's agent read the back-office", async () => {
    const { isError, data } = await callTool(adminToken, "call_route", { method: "GET", path: "/api/admin/speakers" });

    expect(isError).toBe(false);
    expect(data.status).toBe(200);
  });

  it("should relay the back-office's refusal to a sponsor's agent", async () => {
    const { isError, data } = await callTool(sponsorToken, "call_route", { method: "GET", path: "/api/admin/speakers" });

    expect(isError).toBe(true);
    expect(data.status).toBe(403);
  });

  it("should let a sponsor's agent edit its company, filed in the history as MCP", async () => {
    const { data } = await callTool(sponsorToken, "call_route", {
      method: "PUT",
      path: `/api/sponsor-space/${sponsorId}`,
      body: { websiteUrl: "https://agent.example.com" },
    });

    expect(data.status).toBe(200);
    const line = await prisma.auditLog.findFirst({
      where: { entity: "Sponsor", entityId: String(sponsorId), action: "UPDATE" },
      orderBy: { id: "desc" },
    });
    expect(line).toMatchObject({ channel: "MCP", actorUserId: sponsorUserId });
  });

  it("should not let an agent reach the account endpoints", async () => {
    const { isError, data } = await callTool(adminToken, "call_route", { method: "POST", path: "/api/auth/sign-out" });

    expect(isError).toBe(true);
    expect(data).toContain("non disponible");
  });
});

describe("credentials an agent must not manage (#514, API rights audit)", () => {
  it("should not let an agent mint an API key, which would outlive its consent", async () => {
    const before = await prisma.apiKey.count();

    const direct = await app.inject({
      method: "POST",
      url: "/api/me/api-keys",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "agent-made" },
    });
    const viaTool = await callTool(adminToken, "call_route", {
      method: "POST",
      path: "/api/me/api-keys",
      body: { name: "agent-made" },
    });

    expect(direct.statusCode).toBe(403);
    expect(viaTool.isError).toBe(true);
    expect(await prisma.apiKey.count()).toBe(before);
  });

  it("should not let an admin's agent change accounts", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${sponsorUserId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { role: "ADMIN" },
    });

    expect(res.statusCode).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: sponsorUserId } })).role).toBe("SPONSOR");
  });

  it("should not be fooled by a percent-encoded path", async () => {
    const { isError, data } = await callTool(adminToken, "call_route", { method: "GET", path: "/api/%6De/agents" });

    expect(isError).toBe(true);
    expect(data).toContain("non disponible");
  });
});

describe("POST /api/mcp — revocation (#514)", () => {
  it("should cut an agent off once its person withdraws consent", async () => {
    const user = await createUserWithPassword("EDITOR", "Agent Revoked");
    created.userIds.push(user.id);
    const token = await obtainAgentToken(app, clientId, user.email);
    expect((await rpc(token, "tools/list")).statusCode).toBe(200);

    await prisma.oauthConsent.deleteMany({ where: { clientId, userId: user.id } });

    expect((await rpc(token, "tools/list")).statusCode).toBe(401);
  });

  it("should cut an agent off once its account is banned", async () => {
    const user = await createUserWithPassword("EDITOR", "Agent Banned");
    created.userIds.push(user.id);
    const token = await obtainAgentToken(app, clientId, user.email);

    await prisma.user.update({ where: { id: user.id }, data: { banned: true } });

    expect((await rpc(token, "tools/list")).statusCode).toBe(401);
  });
});
