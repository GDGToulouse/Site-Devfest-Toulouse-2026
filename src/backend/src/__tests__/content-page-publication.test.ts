import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "./test-app.js";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";

// #419 — `ContentPage` was a store for two hardcoded routes until the
// `[locale]/[slug]` segment opened every row to the public (#421). The
// publication filter meant to ship with that route never did, so a page created
// from the admin went live the moment it was saved, and no DELETE route existed
// to take it down.

const created: number[] = [];

async function createPage(payload: Record<string, unknown>) {
  const app = await buildAdminApp();
  const res = await app.inject({ method: "POST", url: "/api/admin/pages", payload });
  await app.close();
  const { id } = res.json();
  created.push(id);
  return { id, status: res.statusCode };
}

afterEach(async () => {
  while (created.length) {
    const id = created.pop();
    await prisma.contentPage.deleteMany({ where: { id } });
  }
});

describe("Content page publication", () => {
  it("should create a page as a draft when nothing says otherwise", async () => {
    const slug = `draft-page-${Date.now()}`;
    const { id, status } = await createPage({
      slug,
      titleFr: "Brouillon",
      titleEn: "Draft",
      contentFr: "<p>FR</p>",
      contentEn: "<p>EN</p>",
    });
    expect(status).toBe(201);

    const stored = await prisma.contentPage.findUnique({ where: { id } });
    expect(stored?.isPublished).toBe(false);
  });

  it("should answer 404 on the public route while the page is a draft", async () => {
    const slug = `hidden-page-${Date.now()}`;
    await createPage({
      slug,
      titleFr: "Cachée",
      titleEn: "Hidden",
      contentFr: "<p>FR</p>",
      contentEn: "<p>EN</p>",
    });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/pages/${slug}` });
    await app.close();

    expect(res.statusCode).toBe(404);
  });

  it("should serve the page once it is published", async () => {
    const slug = `live-page-${Date.now()}`;
    const { id } = await createPage({
      slug,
      titleFr: "Visible",
      titleEn: "Visible",
      contentFr: "<p>FR</p>",
      contentEn: "<p>EN</p>",
    });

    const admin = await buildAdminApp();
    const put = await admin.inject({
      method: "PUT",
      url: `/api/admin/pages/${id}`,
      payload: { isPublished: true },
    });
    await admin.close();
    expect(put.statusCode).toBe(200);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/pages/${slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe(slug);
  });

  it("should leave a draft out of the public list", async () => {
    const slug = `unlisted-page-${Date.now()}`;
    await createPage({
      slug,
      titleFr: "Hors liste",
      titleEn: "Unlisted",
      contentFr: "<p>FR</p>",
      contentEn: "<p>EN</p>",
    });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/pages" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const slugs = res.json().map((p: { slug: string }) => p.slug);
    expect(slugs).not.toContain(slug);
  });

  it("should take a published page down again when it goes back to draft", async () => {
    const slug = `retracted-page-${Date.now()}`;
    const { id } = await createPage({
      slug,
      titleFr: "Retirée",
      titleEn: "Retracted",
      contentFr: "<p>FR</p>",
      contentEn: "<p>EN</p>",
      isPublished: true,
    });

    const live = await buildApp();
    expect((await live.inject({ method: "GET", url: `/api/pages/${slug}` })).statusCode).toBe(200);
    await live.close();

    const admin = await buildAdminApp();
    await admin.inject({
      method: "PUT",
      url: `/api/admin/pages/${id}`,
      payload: { isPublished: false },
    });
    await admin.close();

    const after = await buildApp();
    const res = await after.inject({ method: "GET", url: `/api/pages/${slug}` });
    await after.close();

    expect(res.statusCode).toBe(404);
  });
});

describe("Content page deletion", () => {
  it("should move the page to the trash and free its slug", async () => {
    const slug = `deletable-page-${Date.now()}`;
    const { id } = await createPage({
      slug,
      titleFr: "Jetable",
      titleEn: "Disposable",
      contentFr: "",
      contentEn: "",
      isPublished: true,
    });

    const admin = await buildAdminApp();
    const del = await admin.inject({ method: "DELETE", url: `/api/admin/pages/${id}` });
    await admin.close();
    expect(del.statusCode).toBe(200);

    const stored = await prisma.contentPage.findUnique({ where: { id } });
    expect(stored?.deletedAt).not.toBeNull();
    // The slug is globally unique; a trashed row parks it so the same slug can
    // be used again (#146).
    expect(stored?.slug).not.toBe(slug);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/pages/${slug}` });
    await app.close();
    expect(res.statusCode).toBe(404);
  });

  it("should hide a trashed page from the admin list", async () => {
    const slug = `trashed-page-${Date.now()}`;
    const { id } = await createPage({
      slug,
      titleFr: "Corbeille",
      titleEn: "Trash",
      contentFr: "",
      contentEn: "",
    });

    const admin = await buildAdminApp();
    await admin.inject({ method: "DELETE", url: `/api/admin/pages/${id}` });
    const list = await admin.inject({ method: "GET", url: "/api/admin/pages" });
    await admin.close();

    const ids = list.json().map((p: { id: number }) => p.id);
    expect(ids).not.toContain(id);
  });

  it("should refuse to delete a page served by its own route", async () => {
    const existing = await prisma.contentPage.findUnique({ where: { slug: "mentions-legales" } });
    if (!existing) return; // seeded environments only

    const admin = await buildAdminApp();
    const res = await admin.inject({ method: "DELETE", url: `/api/admin/pages/${existing.id}` });
    await admin.close();

    expect(res.statusCode).toBe(409);
    const still = await prisma.contentPage.findUnique({ where: { id: existing.id } });
    expect(still?.deletedAt).toBeNull();
  });

  it("should refuse to unpublish a page served by its own route", async () => {
    const existing = await prisma.contentPage.findUnique({ where: { slug: "code-de-conduite" } });
    if (!existing) return; // seeded environments only

    const admin = await buildAdminApp();
    const res = await admin.inject({
      method: "PUT",
      url: `/api/admin/pages/${existing.id}`,
      payload: { isPublished: false },
    });
    await admin.close();

    expect(res.statusCode).toBe(409);
    const still = await prisma.contentPage.findUnique({ where: { id: existing.id } });
    expect(still?.isPublished).toBe(true);
  });
});
