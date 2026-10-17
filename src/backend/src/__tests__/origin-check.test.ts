import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../server.js";
import { trustedOrigins } from "../lib/auth.js";

// SameSite=Lax stops cross-site POSTs, not same-site ones: any page under the
// registered domain (old sites, other environments) shares the site and gets
// the session cookie attached. A write carried by that cookie must come from
// one of our own origins (#658).

let app: FastifyInstance;
const COOKIE = "better-auth.session_token=forged";

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("origin check on cookie-carried writes", () => {
  it("should refuse a write from a foreign origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/cache/purge",
      headers: { cookie: COOKIE, origin: "https://old.devfesttoulouse.fr", "content-type": "text/plain" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("invalid_origin");
  });

  it("should refuse a write that names no origin and is not same-origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/cache/purge",
      headers: { cookie: COOKIE, "sec-fetch-site": "same-site" },
    });

    expect(res.json().error).toBe("invalid_origin");
  });

  it("should let a write from our own origin through to the route's own checks", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/cache/purge",
      headers: { cookie: COOKIE, origin: trustedOrigins[0] },
    });

    expect(res.json().error).not.toBe("invalid_origin");
  });

  it("should leave a reading request alone", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: { cookie: COOKIE, origin: "https://old.devfesttoulouse.fr" },
    });

    expect(res.statusCode).toBe(200);
  });
});
