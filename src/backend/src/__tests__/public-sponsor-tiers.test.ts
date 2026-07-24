import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import editionRoutes from "../routes/editions.js";

// #318 — public catalogue for /devenir-sponsor. Asserts against the seeded
// featured edition (2026), which has four visible bindings. Read-only, so it is
// safe under Vitest's parallel file execution.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(editionRoutes, { prefix: "/api" });
  return app;
}

describe("Public sponsor tiers (#318)", () => {
  it("returns the featured edition's visible tiers, sorted, with parsed advantages", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/current/sponsor-tiers" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(4);

    // Shape: advantages parsed to an array, no isFeatured field (dropped in #317).
    const platinum = body.find((t: { nameFr: string }) => t.nameFr === "Platinum");
    expect(platinum).toBeDefined();
    expect(Array.isArray(platinum.advantages)).toBe(true);
    expect("isFeatured" in platinum).toBe(false);
    expect(platinum).toHaveProperty("color");
    expect(platinum).toHaveProperty("logoScale");
    expect(platinum).toHaveProperty("standSize");
    // price is the per-edition override (null in the seed).
    expect("price" in platinum).toBe(true);
  });
});
