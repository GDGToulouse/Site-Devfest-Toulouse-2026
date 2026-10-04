process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
// The real server logs every request; the probes below would flood the output.
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../server.js";
import { inventoryOf, KNOWN_GUARDS, SELF_GUARDED, type InventoryRoute } from "../lib/route-inventory.js";
import { listRegisteredRoutes } from "../lib/route-catalog.js";

// #514 — the MCP connector lets an AI agent call any route with its person's
// token, so a route that forgets its guard is one an agent can reach. This
// pins it on the real server: a route that writes, or that lives in a private
// area, must carry a known guard — or appear in SELF_GUARDED
// (lib/route-inventory.ts), with the reason it checks the caller itself.
// Inventory and verdicts: docs/audit-droits-api.md.


// Wildcard routes Fastify's route printer leaves out of its tree, each read-only
// or authenticating on its own terms: better-auth for the first three, public
// static files (uploads, the API docs' assets) for the rest.
const UNPRINTED = new Set([
  "GET /api/auth/*",
  "POST /api/auth/*",
  "GET /.well-known/*",
  "GET /uploads/*",
  "GET /api/docs/static/*",
]);

const PRIVATE_AREAS = ["/api/admin/", "/api/me/", "/api/sponsor-space/"];

const key = (route: { method: string; path: string }) => `${route.method} ${route.path}`;

let app: FastifyInstance;
let routes: InventoryRoute[];

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
  routes = inventoryOf(app).filter((r) => r.method !== "HEAD" && r.method !== "OPTIONS");
});

afterAll(async () => {
  await app.close();
});

function isGuarded(route: InventoryRoute) {
  return route.preHandlers.some((name) => name in KNOWN_GUARDS);
}

describe("API route guards (#514)", () => {
  it("should read every registered route, so none escapes the checks below", () => {
    const printed = new Set(routes.map(key));
    const missing = listRegisteredRoutes().map(key).filter((k) => !printed.has(k) && !UNPRINTED.has(k));

    expect(missing).toEqual([]);
  });

  it("should guard every route that writes", () => {
    const unguarded = routes
      .filter((r) => r.method !== "GET" && !isGuarded(r) && !SELF_GUARDED[key(r)])
      .map(key);

    expect(unguarded).toEqual([]);
  });

  it("should guard every route of the back-office, the account and the partner space", () => {
    const unguarded = routes
      .filter((r) => PRIVATE_AREAS.some((area) => r.path.startsWith(area)) && !isGuarded(r) && !SELF_GUARDED[key(r)])
      .map(key);

    expect(unguarded).toEqual([]);
  });

  it("should keep the exceptions list to routes that exist", () => {
    const existing = new Set(routes.map(key));

    expect(Object.keys(SELF_GUARDED).filter((k) => !existing.has(k))).toEqual([]);
  });

  it.each(Object.entries(SELF_GUARDED).filter(([, rule]) => rule.anonymous))(
    "should still refuse an anonymous caller on %s",
    async (route, rule) => {
      const [method, path] = route.split(" ");
      // Numeric ids must pass validation to reach the check under test.
      const url = path.replace(/:\w*[Ii]d\b/g, "999999999").replace(/:\w+/g, "not-a-real-value");

      const res = await app.inject({ method: method as "GET", url, payload: method === "GET" ? undefined : {} });

      expect(rule.anonymous).toContain(res.statusCode);
    },
  );
});
