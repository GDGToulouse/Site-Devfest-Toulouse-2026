import { describe, it, expect } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";

describe("Admin Pages API", () => {
  it("GET /api/admin/pages should list content pages", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/pages" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const page of body) {
      expect(page).toHaveProperty("slug");
      expect(page).toHaveProperty("titleFr");
    }
    await app.close();
  });

  it("POST then GET then PUT a page", async () => {
    const app = await buildAdminApp();
    const slug = `test-page-${Date.now()}`;

    // Create
    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/pages",
      payload: {
        slug,
        titleFr: "Page Test FR",
        titleEn: "Test Page EN",
        contentFr: "<p>Contenu</p>",
        contentEn: "<p>Content</p>",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();

    // Read
    const getRes = await app.inject({ method: "GET", url: `/api/admin/pages/${id}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().slug).toBe(slug);

    // Update
    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/admin/pages/${id}`,
      payload: {
        titleFr: "Page Test FR Modifiee",
        titleEn: "Test Page EN Updated",
        contentFr: "<p>Nouveau</p>",
        contentEn: "<p>New</p>",
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // Verify update
    const getRes2 = await app.inject({ method: "GET", url: `/api/admin/pages/${id}` });
    expect(getRes2.json().titleFr).toBe("Page Test FR Modifiee");

    // Cleanup via Prisma (no DELETE endpoint for pages)
    await prisma.contentPage.delete({ where: { id } });

    await app.close();
  });

  it("POST /api/admin/pages should reject duplicate slug", async () => {
    const app = await buildAdminApp();
    const slug = `dup-page-${Date.now()}`;

    const res1 = await app.inject({
      method: "POST",
      url: "/api/admin/pages",
      payload: { slug, titleFr: "P1", titleEn: "P1", contentFr: "", contentEn: "" },
    });
    expect(res1.statusCode).toBe(201);
    const { id } = res1.json();

    const res2 = await app.inject({
      method: "POST",
      url: "/api/admin/pages",
      payload: { slug, titleFr: "P2", titleEn: "P2", contentFr: "", contentEn: "" },
    });
    expect(res2.statusCode).toBe(409);

    // Cleanup via Prisma
    await prisma.contentPage.delete({ where: { id } });

    await app.close();
  });
});
