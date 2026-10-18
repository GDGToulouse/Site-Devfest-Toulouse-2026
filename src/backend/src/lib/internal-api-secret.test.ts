import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API_RATE_LIMIT_MAX, INTERNAL_API_HEADER, rateLimitOptions } from "./rate-limit-options.js";
import { trustProxyHops } from "./server-options.js";

// #689 — the frontend's server-side calls (SSR) all arrive from the frontend
// container and shared one visitor budget: a traffic spike on uncached pages
// answered 429 to the frontend, hence error pages for everyone.

const SECRET = "s3cret-shared-between-frontend-and-backend";
const FRONTEND = "172.18.0.5";
const BURST = API_RATE_LIMIT_MAX + 60;

async function probeApp() {
  const app = Fastify({ logger: false, trustProxy: trustProxyHops("1") });
  await app.register(rateLimit, rateLimitOptions);
  app.get("/api/editions", async () => ({ ok: true }));
  return app;
}

async function burst(headers: Record<string, string>, times = BURST) {
  const app = await probeApp();
  const codes: number[] = [];
  for (let i = 0; i < times; i++) {
    codes.push((await app.inject({ method: "GET", url: "/api/editions", remoteAddress: FRONTEND, headers })).statusCode);
  }
  await app.close();
  return codes;
}

describe("server-side calls of the frontend (#689)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("should never answer 429 to a burst carrying the shared secret", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);

    const codes = await burst({ [INTERNAL_API_HEADER]: SECRET });

    expect(codes).not.toContain(429);
  });

  it("should still limit the same burst without the secret", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);

    expect((await burst({})).at(-1)).toBe(429);
  });

  it("should still limit a burst with a wrong secret", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);

    expect((await burst({ [INTERNAL_API_HEADER]: "wrong-secret" })).at(-1)).toBe(429);
  });

  it.each([undefined, ""])("should exempt nobody when the secret is %j, even an empty header", async (value) => {
    if (value === undefined) vi.unstubAllEnvs();
    else vi.stubEnv("INTERNAL_API_SECRET", value);

    expect((await burst({ [INTERNAL_API_HEADER]: "" })).at(-1)).toBe(429);
  });

  it("should still limit a browser call relayed by the frontend that forges the header, per visitor IP", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const visitor = { "x-forwarded-for": "203.0.113.9", [INTERNAL_API_HEADER]: "forged" };

    const codes = await burst(visitor);

    expect(codes.at(-1)).toBe(429);
  });

  it("should not honour even the right secret on a relayed call (it carries X-Forwarded-For)", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const relayed = { "x-forwarded-for": "203.0.113.9", [INTERNAL_API_HEADER]: SECRET };

    expect((await burst(relayed)).at(-1)).toBe(429);
  });

  it("should keep two visitors on their own budgets while the frontend is exempt", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", SECRET);
    const app = await probeApp();
    const call = async (headers: Record<string, string>) =>
      (await app.inject({ method: "GET", url: "/api/editions", remoteAddress: FRONTEND, headers })).statusCode;
    for (let i = 0; i < BURST; i++) await call({ "x-forwarded-for": "203.0.113.9" });

    const spent = await call({ "x-forwarded-for": "203.0.113.9" });
    const other = await call({ "x-forwarded-for": "198.51.100.4" });
    const ssr = await call({ [INTERNAL_API_HEADER]: SECRET });
    await app.close();

    expect([spent, other, ssr]).toEqual([429, 200, 200]);
  });
});
