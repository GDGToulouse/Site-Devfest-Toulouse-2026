import Fastify, { type FastifyServerOptions } from "fastify";
import { describe, it, expect } from "vitest";

import { MAX_PARAM_LENGTH, serverOptions } from "./server-options.js";

// The longest slug the historical import produces, character for character
// (#467) — a 2018 talk, 168 characters. Three talks out of 279 pass 100, and
// each is served in two locales: the six URLs the report listed as 5xx.
const LONGEST_SLUG_IN_PRODUCTION =
  "comment-t-organiser-quand-tu-es-b-lique-de-naissance-et-depuis-des-decennies-que-tu-as-plusieurs-jobs-ou-projets-sans-exploser-en-vol-et-bosser-a-plusieurs-et-y-arriver";

async function probeApp(options: FastifyServerOptions) {
  const app = Fastify({ ...options, logger: false });
  app.get("/api/talks/:slug", async (request) => ({
    slug: (request.params as { slug: string }).slug,
  }));
  return app;
}

describe("route parameter length (#467)", () => {
  it("lets the longest production slug reach the handler", async () => {
    const app = await probeApp(serverOptions);

    const response = await app.inject({
      method: "GET",
      url: `/api/talks/${LONGEST_SLUG_IN_PRODUCTION}`,
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("answers 414 on Fastify's own default — the defect being fixed", async () => {
    // The discriminant. Without it, the test above passes on a default app for
    // any slug under 100 characters and proves nothing about the option.
    const app = await probeApp({});

    const response = await app.inject({
      method: "GET",
      url: `/api/talks/${LONGEST_SLUG_IN_PRODUCTION}`,
    });

    expect(response.statusCode).toBe(414);
    await app.close();
  });

  it("keeps a ceiling rather than lifting it altogether", async () => {
    // Unbounded would be the lazy fix: the limit exists to bound the router's
    // work, and a slug past this is a data problem worth surfacing.
    const app = await probeApp(serverOptions);

    const response = await app.inject({
      method: "GET",
      url: `/api/talks/${"a".repeat(MAX_PARAM_LENGTH + 1)}`,
    });

    expect(response.statusCode).toBe(414);
    await app.close();
  });
});
