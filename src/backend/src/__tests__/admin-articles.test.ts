import { describe, it, expect } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";

describe("Admin Articles API", () => {
  it("GET /api/admin/articles should list articles with pagination", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/articles" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("articles");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("totalPages");
    expect(Array.isArray(body.articles)).toBe(true);
    await app.close();
  });

  it("POST then GET then PUT then DELETE an article", async () => {
    const app = await buildAdminApp();
    const slug = `test-article-${Date.now()}`;

    // Create
    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/articles",
      payload: {
        slug,
        titleFr: "Test Article FR",
        titleEn: "Test Article EN",
        contentFr: "Contenu FR",
        contentEn: "Content EN",
        publicationStatus: "DRAFT",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();
    expect(id).toBeDefined();

    // Read
    const getRes = await app.inject({ method: "GET", url: `/api/admin/articles/${id}` });
    expect(getRes.statusCode).toBe(200);
    const article = getRes.json();
    expect(article.slug).toBe(slug);
    expect(article.titleFr).toBe("Test Article FR");

    // Update
    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/admin/articles/${id}`,
      payload: { titleFr: "Test Article FR Updated", publicationStatus: "PUBLISHED" },
    });
    expect(updateRes.statusCode).toBe(200);

    // Verify update
    const getRes2 = await app.inject({ method: "GET", url: `/api/admin/articles/${id}` });
    expect(getRes2.json().titleFr).toBe("Test Article FR Updated");
    expect(getRes2.json().publicationStatus).toBe("PUBLISHED");
    expect(getRes2.json().publishedAt).not.toBeNull();

    // Delete
    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/articles/${id}` });
    expect(delRes.statusCode).toBe(200);

    // Verify deleted
    const getRes3 = await app.inject({ method: "GET", url: `/api/admin/articles/${id}` });
    expect(getRes3.statusCode).toBe(404);

    await app.close();
  });

  it("POST with an explicit publishedAt should preserve that date", async () => {
    const app = await buildAdminApp();
    const slug = `dated-article-${Date.now()}`;
    const originalDate = "2023-04-10T08:00:00.000Z";

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/articles",
      payload: {
        slug,
        titleFr: "Daté FR",
        titleEn: "Dated EN",
        contentFr: "",
        contentEn: "",
        publicationStatus: "PUBLISHED",
        publishedAt: originalDate,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();

    const getRes = await app.inject({ method: "GET", url: `/api/admin/articles/${id}` });
    expect(new Date(getRes.json().publishedAt).toISOString()).toBe(originalDate);

    await app.inject({ method: "DELETE", url: `/api/admin/articles/${id}` });
    await app.close();
  });

  it("POST without publishedAt stamps the current date when published", async () => {
    const app = await buildAdminApp();
    const slug = `now-article-${Date.now()}`;
    const before = Date.now();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/articles",
      payload: {
        slug,
        titleFr: "Now FR",
        titleEn: "Now EN",
        contentFr: "",
        contentEn: "",
        publicationStatus: "PUBLISHED",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();

    const getRes = await app.inject({ method: "GET", url: `/api/admin/articles/${id}` });
    const published = new Date(getRes.json().publishedAt).getTime();
    expect(published).toBeGreaterThanOrEqual(before);

    await app.inject({ method: "DELETE", url: `/api/admin/articles/${id}` });
    await app.close();
  });

  it("POST /api/admin/articles should reject duplicate slug", async () => {
    const app = await buildAdminApp();
    const slug = `dup-test-${Date.now()}`;

    const res1 = await app.inject({
      method: "POST",
      url: "/api/admin/articles",
      payload: { slug, titleFr: "T1", titleEn: "T1", contentFr: "", contentEn: "" },
    });
    expect(res1.statusCode).toBe(201);
    const { id } = res1.json();

    const res2 = await app.inject({
      method: "POST",
      url: "/api/admin/articles",
      payload: { slug, titleFr: "T2", titleEn: "T2", contentFr: "", contentEn: "" },
    });
    expect(res2.statusCode).toBe(409);

    // Cleanup
    await app.inject({ method: "DELETE", url: `/api/admin/articles/${id}` });
    await app.close();
  });

  it("GET /api/admin/tags should return tags", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/tags" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    await app.close();
  });

  it("POST then DELETE a tag", async () => {
    const app = await buildAdminApp();
    const name = `Test Tag ${Date.now()}`;

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/tags",
      payload: { name },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();

    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/tags/${id}` });
    expect(delRes.statusCode).toBe(200);

    await app.close();
  });
});
