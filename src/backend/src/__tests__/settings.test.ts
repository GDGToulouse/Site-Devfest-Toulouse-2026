import { describe, it, expect } from "vitest";
import { buildApp } from "./test-app.js";

describe("GET /api/settings/key-figures", () => {
  it("should return key figures array", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/settings/key-figures" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(4);
    for (const fig of body) {
      expect(fig).toHaveProperty("icon");
      expect(fig).toHaveProperty("value");
      expect(fig).toHaveProperty("labelFr");
      expect(fig).toHaveProperty("labelEn");
    }
    await app.close();
  });
});

describe("GET /api/settings/cfp", () => {
  it("should return CFP settings", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/settings/cfp" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("isOpen");
    expect(body).toHaveProperty("sessionizeUrl");
    expect(body).toHaveProperty("openDate");
    expect(body).toHaveProperty("closeDate");
    expect(typeof body.isOpen).toBe("boolean");
    await app.close();
  });
});
