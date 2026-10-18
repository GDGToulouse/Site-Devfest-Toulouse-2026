import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { rateLimitOptions } from "./rate-limit-options.js";
import { trustProxyHops } from "./server-options.js";

// #663 — `trustProxy: true` believed the whole X-Forwarded-For header, so a
// visitor could pick the address the rate limit counts and the logs record. The
// backend now trusts a number of hops, set per environment.

// The frontend container: the one hop between Traefik and the backend.
const FRONTEND = "172.18.0.5";
const REAL_VISITOR = "203.0.113.9";

async function ipSeenBy(hops: string | undefined, headers: Record<string, string>, socket = FRONTEND) {
  const app = Fastify({ logger: false, trustProxy: trustProxyHops(hops) });
  app.get("/ip", async (request) => ({ ip: request.ip }));
  const res = await app.inject({ method: "GET", url: "/ip", remoteAddress: socket, headers });
  await app.close();
  return res.json().ip as string;
}

describe("TRUST_PROXY_HOPS (#663)", () => {
  it("should trust as many hops as asked, and only when they are our own addresses", () => {
    const one = trustProxyHops("1");
    const two = trustProxyHops("2");

    expect(one && one(FRONTEND, 0)).toBe(true);
    expect(one && one(FRONTEND, 1)).toBe(false);
    expect(two && two("::ffff:172.18.0.9", 1)).toBe(true);
    expect(one && one("::1", 0)).toBe(true);
    expect(one && one(REAL_VISITOR, 0)).toBe(false);
    expect(one && one("2001:db8::1", 0)).toBe(false);
  });

  it("should trust nobody when it is unset or zero", () => {
    expect(trustProxyHops("0")).toBe(false);
    expect(trustProxyHops(undefined)).toBe(false);
    expect(trustProxyHops("")).toBe(false);
  });

  it.each(["true", "-1", "1.5", "two", "10.0.0.0/8"])("should refuse %s instead of trusting more than meant", (raw) => {
    expect(() => trustProxyHops(raw)).toThrow(/TRUST_PROXY_HOPS/);
  });

  it("should take the visitor Traefik saw, one hop behind the frontend", async () => {
    expect(await ipSeenBy("1", { "x-forwarded-for": REAL_VISITOR })).toBe(REAL_VISITOR);
  });

  it("should ignore what the visitor put in front of the address Traefik appended", async () => {
    const forged = `6.6.6.6, 7.7.7.7, ${REAL_VISITOR}`;

    expect(await ipSeenBy("1", { "x-forwarded-for": forged })).toBe(REAL_VISITOR);
  });

  it("should answer the socket for a server-side call that carries no header", async () => {
    expect(await ipSeenBy("1", {})).toBe(FRONTEND);
  });

  it("should keep a client that reaches the server directly as itself", async () => {
    expect(await ipSeenBy("1", { "x-forwarded-for": "6.6.6.6" }, REAL_VISITOR)).toBe(REAL_VISITOR);
  });

  it("should ignore the header entirely when no proxy is trusted", async () => {
    expect(await ipSeenBy(undefined, { "x-forwarded-for": "6.6.6.6" })).toBe(FRONTEND);
  });

  it("should not let a forged header change the rate limit counter", async () => {
    const app = Fastify({ logger: false, trustProxy: trustProxyHops("1") });
    await app.register(rateLimit, rateLimitOptions);
    app.get("/api/health", async () => ({ ok: true }));
    const remaining = async (forged: string) => {
      const res = await app.inject({
        method: "GET",
        url: "/api/health",
        remoteAddress: FRONTEND,
        headers: { "x-forwarded-for": `${forged}, ${REAL_VISITOR}` },
      });
      return Number(res.headers["x-ratelimit-remaining"]);
    };

    const first = await remaining("1.1.1.1");
    const second = await remaining("2.2.2.2");
    const third = await remaining("3.3.3.3");
    await app.close();

    expect([first, second, third]).toEqual([first, first - 1, first - 2]);
  });
});
