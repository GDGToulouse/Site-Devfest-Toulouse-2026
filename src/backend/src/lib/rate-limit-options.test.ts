import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { describe, it, expect } from "vitest";

import {
  API_RATE_LIMIT_MAX,
  ARRIVALS_RATE_LIMIT_MAX,
  AUTH_ACCOUNT_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
  OAUTH_RATE_LIMIT_MAX,
  UPLOADS_RATE_LIMIT_MAX,
  arrivalsRateLimit,
  authAccountRateLimit,
  authRateLimit,
  rateLimitOptions,
} from "./rate-limit-options.js";

// A PDF viewer asks for the file in byte ranges, and each range is a request
// (#469). Well past the API budget, well under the uploads one.
const RANGE_REQUESTS = API_RATE_LIMIT_MAX + 50;

async function probeApp(options: Parameters<typeof rateLimit>[1]) {
  const app = Fastify({ logger: false });
  await app.register(rateLimit, options);
  app.get("/uploads/brochure.pdf", async () => "%PDF");
  app.get("/api/editions", async () => ({ ok: true }));
  return app;
}

async function hammer(app: Awaited<ReturnType<typeof probeApp>>, url: string, times: number) {
  const codes: number[] = [];
  for (let i = 0; i < times; i++) {
    codes.push((await app.inject({ method: "GET", url })).statusCode);
  }
  return codes;
}

describe("rate limit on static uploads (#469)", () => {
  it("serves a file asked for in more ranges than the API budget allows", async () => {
    const app = await probeApp(rateLimitOptions);

    const codes = await hammer(app, "/uploads/brochure.pdf", RANGE_REQUESTS);

    expect(codes.every((code) => code === 200)).toBe(true);
    await app.close();
  });

  it("answers 429 under a single shared budget — the defect being fixed", async () => {
    // The discriminant: the flat configuration that shipped, so the test above
    // cannot pass by accident on a permissive default.
    const app = await probeApp({ max: API_RATE_LIMIT_MAX, timeWindow: "1 minute" });

    const codes = await hammer(app, "/uploads/brochure.pdf", RANGE_REQUESTS);

    expect(codes.at(-1)).toBe(429);
    await app.close();
  });

  it("leaves the API budget untouched while a file is being read", async () => {
    // What made the bug expensive: reading a brochure locked the visitor out
    // of the site's own API for a minute.
    const app = await probeApp(rateLimitOptions);
    await hammer(app, "/uploads/brochure.pdf", RANGE_REQUESTS);

    const response = await app.inject({ method: "GET", url: "/api/editions" });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("keeps a ceiling on the uploads rather than exempting them", async () => {
    const app = await probeApp(rateLimitOptions);

    const codes = await hammer(app, "/uploads/brochure.pdf", UPLOADS_RATE_LIMIT_MAX + 1);

    expect(codes.at(-1)).toBe(429);
    await app.close();
  });
});

describe("rate limit on auth and the MCP connector's OAuth endpoints (#514)", () => {
  async function authApp() {
    const app = Fastify({ logger: false });
    await app.register(rateLimit, rateLimitOptions);
    const config = { rateLimit: authRateLimit };
    app.post("/api/auth/sign-in/email", { config }, async () => ({ ok: true }));
    app.post("/api/auth/oauth2/token", { config }, async () => ({ ok: true }));
    return app;
  }

  async function post(app: Awaited<ReturnType<typeof authApp>>, url: string, times: number) {
    const codes: number[] = [];
    for (let i = 0; i < times; i++) codes.push((await app.inject({ method: "POST", url })).statusCode);
    return codes;
  }

  it("keeps the strict sign-in budget", async () => {
    const codes = await post(await authApp(), "/api/auth/sign-in/email", AUTH_RATE_LIMIT_MAX + 1);

    expect(codes.at(-1)).toBe(429);
  });

  it("gives an agent's token requests their own budget", async () => {
    const app = await authApp();

    const oauth = await post(app, "/api/auth/oauth2/token", OAUTH_RATE_LIMIT_MAX);
    const signIn = await post(app, "/api/auth/sign-in/email", 1);

    expect(oauth).not.toContain(429);
    expect(signIn).toEqual([200]);
  });

  it("still caps the OAuth endpoints", async () => {
    const codes = await post(await authApp(), "/api/auth/oauth2/token", OAUTH_RATE_LIMIT_MAX + 1);

    expect(codes.at(-1)).toBe(429);
  });
});

describe("rate limit at the venue, where every phone shares one address (#642)", () => {
  // Wired as plugins/auth-routes.ts wires it: per IP on the route, per account
  // in preHandler.
  async function venueApp() {
    const app = Fastify({ logger: false });
    await app.register(rateLimit, rateLimitOptions);
    app.post(
      "/api/auth/sign-in/email",
      { config: { rateLimit: authRateLimit }, preHandler: [authAccountRateLimit(app)] },
      async () => ({ ok: true }),
    );
    app.get("/api/arrivals/current", { config: { rateLimit: arrivalsRateLimit } }, async () => ({ ok: true }));
    app.get("/api/editions", async () => ({ ok: true }));
    return app;
  }

  const signIn = (app: Awaited<ReturnType<typeof venueApp>>, email: string) =>
    app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "x" } });

  it("should let forty volunteers sign in within the same minute", async () => {
    const app = await venueApp();

    const codes = [];
    for (let i = 0; i < 40; i++) codes.push((await signIn(app, `benevole-${i}@example.org`)).statusCode);

    expect(codes).not.toContain(429);
  });

  it("should still hold one account to its budget, and not lock out the others", async () => {
    const app = await venueApp();

    const codes = [];
    for (let i = 0; i <= AUTH_ACCOUNT_RATE_LIMIT_MAX; i++) codes.push((await signIn(app, "Lea@example.org")).statusCode);
    const sameAccountOtherCase = await signIn(app, "lea@example.org");
    const otherAccount = await signIn(app, "max@example.org");

    expect(codes.at(-1)).toBe(429);
    expect(sameAccountOtherCase.statusCode).toBe(429);
    expect(otherAccount.statusCode).toBe(200);
  });

  it("should give the event-day screens their own bucket, past the API budget", async () => {
    const app = await venueApp();

    const codes = await hammer(app as Awaited<ReturnType<typeof probeApp>>, "/api/arrivals/current", API_RATE_LIMIT_MAX + 50);
    const site = await app.inject({ method: "GET", url: "/api/editions" });

    expect(codes).not.toContain(429);
    expect(site.statusCode).toBe(200);
  });

  it("should still cap the event-day screens", async () => {
    const app = await venueApp();

    const codes = await hammer(app as Awaited<ReturnType<typeof probeApp>>, "/api/arrivals/current", ARRIVALS_RATE_LIMIT_MAX + 1);

    expect(codes.at(-1)).toBe(429);
  });
});
