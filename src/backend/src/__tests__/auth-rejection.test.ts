// Smoke tests proving that the real admin auth guards reject unauthenticated
// callers. The other admin test files (test-admin-app.ts) deliberately mount
// routes WITHOUT the guards to test handler logic in isolation; this file
// mounts the production admin router (adminRoutes) and asserts every shape
// of unauthenticated access returns 401/403 rather than the resource.
//
// Why: it's easy to introduce a regression where a route is registered
// outside the protected scope (cf. routes/admin/index.ts grouping by role).
// These tests catch that immediately.

process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import adminRoutes from "../routes/admin/index.js";
import { registerCommonSchemas } from "../schemas/common.js";
import { registerApiKeySchemas } from "../schemas/api-key.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  // Decorate request with the same fields the real index.ts decorates,
  // otherwise admin-guard's `request.adminUser = ...` would throw.
  app.decorateRequest("adminUser");
  app.decorateRequest("authContext");
  // Admin routes reference shared JSON schemas ($ref) that live in index.ts.
  // Register them here too so the serializer can resolve them.
  registerCommonSchemas(app);
  registerApiKeySchemas(app);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const PROBES: { method: "GET" | "POST" | "PUT" | "DELETE"; url: string }[] = [
  // EDITOR-or-ADMIN endpoints (requireAdmin)
  { method: "GET", url: "/api/admin/articles" },
  { method: "POST", url: "/api/admin/articles" },
  { method: "GET", url: "/api/admin/pages" },
  { method: "GET", url: "/api/admin/contact/categories" },
  { method: "GET", url: "/api/admin/contact/messages" },
  { method: "GET", url: "/api/admin/files" },
  // ADMIN-only endpoints (requireAdminRole)
  { method: "GET", url: "/api/admin/editions" },
  { method: "GET", url: "/api/admin/users" },
  { method: "GET", url: "/api/admin/api-keys" },
  { method: "GET", url: "/api/admin/settings/general" },
  { method: "POST", url: "/api/admin/cache/purge" },
];

describe("admin routes reject unauthenticated callers", () => {
  for (const probe of PROBES) {
    it(`${probe.method} ${probe.url} -> 403`, async () => {
      const res = await app.inject({ method: probe.method, url: probe.url });
      expect(res.statusCode, `${probe.method} ${probe.url} returned ${res.statusCode}`).toBe(403);
    });
  }

  it("/api/admin/session is also gated", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/session" });
    expect(res.statusCode).toBe(403);
  });
});
