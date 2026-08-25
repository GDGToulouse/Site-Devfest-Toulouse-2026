import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { describe, it, expect } from "vitest";

import {
  API_RATE_LIMIT_MAX,
  UPLOADS_RATE_LIMIT_MAX,
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
