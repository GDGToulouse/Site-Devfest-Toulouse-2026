import { describe, it, expect } from "vitest";
import { buildApp } from "./test-app.js";

describe("GET /api/articles/latest", () => {
  it("should return latest published articles", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/articles/latest?limit=4" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(4);
    for (const article of body) {
      expect(article).toHaveProperty("slug");
      expect(article).toHaveProperty("titleFr");
      expect(article).toHaveProperty("tags");
    }
    await app.close();
  });
});

describe("GET /api/articles (paginated)", () => {
  it("should return paginated articles", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/articles?page=1&limit=9" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("articles");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page", 1);
    expect(body).toHaveProperty("totalPages");
    expect(body.articles.length).toBeLessThanOrEqual(9);
    await app.close();
  });

  it("should filter articles by tag", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/articles?tag=web" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.articles.length).toBeGreaterThan(0);
    await app.close();
  });
});

describe("GET /api/articles/:slug", () => {
  it("should return article detail with content", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/articles/cfp-ouvert-2026" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("slug", "cfp-ouvert-2026");
    expect(body).toHaveProperty("contentFr");
    expect(body).toHaveProperty("contentEn");
    expect(body).toHaveProperty("tags");
    await app.close();
  });

  it("should return 404 for unknown slug", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/articles/slug-inexistant" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /api/tags", () => {
  it("should return all tags", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/tags" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const tag of body) {
      expect(tag).toHaveProperty("name");
      expect(tag).toHaveProperty("slug");
    }
    await app.close();
  });
});
