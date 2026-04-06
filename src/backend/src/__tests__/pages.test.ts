import { describe, it, expect } from "vitest";
import { buildApp } from "./test-app.js";

describe("GET /api/pages/:slug", () => {
  it("should return Code of Conduct page", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/pages/code-de-conduite" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("slug", "code-de-conduite");
    expect(body).toHaveProperty("titleFr");
    expect(body).toHaveProperty("contentFr");
    expect(body).toHaveProperty("titleEn");
    expect(body).toHaveProperty("contentEn");
    await app.close();
  });

  it("should return Legal Notice page", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/pages/mentions-legales" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("slug", "mentions-legales");
    await app.close();
  });

  it("should return 404 for unknown page", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/pages/page-inexistante" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
