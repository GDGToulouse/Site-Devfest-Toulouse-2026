// better-auth keeps its own rate limit on sign-in, magic link and password
// reset, keyed by the client IP it reads from the request headers. That IP must
// be the one Fastify resolved through TRUST_PROXY_HOPS (#663), not whatever the
// visitor wrote in X-Forwarded-For (#688).

process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { getIP } from "better-auth/api";

import { auth } from "../lib/auth.js";
import { trustProxyHops } from "../lib/server-options.js";
import { registerAuthRoutes } from "../plugins/auth-routes.js";

/** Send one sign-in through the real auth routes; return what better-auth would key on. */
async function betterAuthIpFor(hops: string, forwardedFor: string) {
  let seen: Request | undefined;
  vi.spyOn(auth, "handler").mockImplementation(async (req: Request) => {
    seen = req;
    return new Response(null, { status: 200 });
  });

  const app = Fastify({ trustProxy: trustProxyHops(hops) });
  await app.register(rateLimit, { global: false });
  await registerAuthRoutes(app);
  let fastifyIp: string | undefined;
  app.addHook("onRequest", async (request) => {
    fastifyIp = request.ip;
  });
  await app.ready();

  await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { "x-forwarded-for": forwardedFor, "content-type": "application/json" },
    payload: { email: "someone@example.com", password: "whatever-password" },
  });
  await app.close();

  expect(seen, "better-auth was not reached").toBeDefined();
  return { betterAuthIp: getIP(seen!, auth.options), fastifyIp };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("better-auth reads the client IP Fastify resolved (#688)", () => {
  it("ignores a forged address left of the trusted hop", async () => {
    const { betterAuthIp, fastifyIp } = await betterAuthIpFor("1", "6.6.6.6, 203.0.113.7");
    expect(fastifyIp).toBe("203.0.113.7");
    expect(betterAuthIp).toBe("203.0.113.7");
  });

  it("does not let a direct client pick its address when no proxy is trusted", async () => {
    const { betterAuthIp, fastifyIp } = await betterAuthIpFor("0", "6.6.6.6");
    expect(betterAuthIp).toBe(fastifyIp);
    expect(betterAuthIp).not.toBe("6.6.6.6");
  });

  it("keys two different forged headers to the same counter", async () => {
    const first = await betterAuthIpFor("0", "1.1.1.1");
    const second = await betterAuthIpFor("0", "2.2.2.2");
    expect(first.betterAuthIp).toBe(second.betterAuthIp);
  });
});
