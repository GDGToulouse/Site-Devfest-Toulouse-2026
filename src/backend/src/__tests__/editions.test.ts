import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "./test-app.js";

describe("GET /api/editions/current", () => {
  it("should return the current edition", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/current" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("year", 2026);
    expect(body).toHaveProperty("status", "ANNOUNCEMENT");
    expect(body).toHaveProperty("aftermovieUrl");
    await app.close();
  });
});

describe("GET /api/editions/current/ticket-tiers", () => {
  it("should return active ticket tiers", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/current/ticket-tiers" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const tier of body) {
      expect(tier).toHaveProperty("nameFr");
      expect(tier).toHaveProperty("price");
      expect(["AVAILABLE", "SOLD_OUT"]).toContain(tier.status);
    }
    await app.close();
  });
});
