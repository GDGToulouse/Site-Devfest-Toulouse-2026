process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../server.js";
import { listRegisteredRoutes } from "../lib/route-catalog.js";

// #494 — the public site answers /api/... only for the prefixes its rewrites
// relay to the backend (src/frontend/next.config.ts); anything else falls on
// Next's HTML 404. Articles, tags, pages, categories and settings were documented
// in the public API yet unreachable on devfesttoulouse.fr. This pins every
// backend route under /api to a rewrite, so a new one cannot be forgotten.
//
// The backend container mounts src/backend only: there the frontend file is
// absent and the check is skipped. It runs in CI, where the whole repository is.
const NEXT_CONFIG = new URL("../../../frontend/next.config.ts", import.meta.url);

/** A rewrite source as a regex: `:path*` is any tail, `:name` one segment. */
function sourcePattern(source: string): RegExp {
  const body = source
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\/:\w+\*/g, "(?:/.*)?")
    .replace(/:\w+/g, "[^/]+");
  return new RegExp(`^${body}$`);
}

/** A concrete path for a route pattern: each parameter and wildcard filled in. */
function samplePath(route: string): string {
  return route.replace(/:\w+/g, "x").replace(/\*/g, "x");
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe.skipIf(!existsSync(NEXT_CONFIG))("frontend rewrites cover the backend API (#494)", () => {
  it("should relay every backend route under /api to the backend", () => {
    const config = readFileSync(NEXT_CONFIG, "utf8");
    const sources = [...config.matchAll(/source:\s*"(\/api\/[^"]+)"/g)].map((m) => sourcePattern(m[1]));
    const paths = [...new Set(listRegisteredRoutes().map((r) => r.path))].filter((p) => p.startsWith("/api/"));

    const unreachable = paths.filter((p) => !sources.some((pattern) => pattern.test(samplePath(p))));

    expect(sources.length).toBeGreaterThan(0);
    expect(unreachable).toEqual([]);
  });
});
