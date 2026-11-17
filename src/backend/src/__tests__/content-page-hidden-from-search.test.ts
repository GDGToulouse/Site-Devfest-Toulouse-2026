import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "./test-app.js";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";

// #854 — a page online for whoever has the link, but kept out of search
// engines: the public routes still serve it, and tell the site to leave it out
// of the sitemap and to mark it `noindex, nofollow`.

const created: number[] = [];

async function publishedPage(extra: Record<string, unknown> = {}) {
  const slug = `page-masquee-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const admin = await buildAdminApp();
  const res = await admin.inject({
    method: "POST",
    url: "/api/admin/pages",
    payload: { slug, titleFr: "Consignes", titleEn: "Briefing", contentFr: "<p>FR</p>", contentEn: "<p>EN</p>", isPublished: true, ...extra },
  });
  await admin.close();
  const { id } = res.json();
  created.push(id);
  return { id, slug };
}

afterEach(async () => {
  while (created.length) {
    const id = created.pop();
    await prisma.contentPage.deleteMany({ where: { id } });
  }
});

describe("Content page hidden from search engines (#854)", () => {
  it("should leave a new page open to search engines unless asked", async () => {
    const { id } = await publishedPage();

    const stored = await prisma.contentPage.findUniqueOrThrow({ where: { id } });

    expect(stored.isHiddenFromSearch).toBe(false);
  });

  it("should still serve a hidden page by its link, saying it is hidden", async () => {
    const { slug } = await publishedPage({ isHiddenFromSearch: true });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/pages/${slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json().isHiddenFromSearch).toBe(true);
  });

  it("should flag a hidden page in the list the sitemap reads", async () => {
    const { slug } = await publishedPage({ isHiddenFromSearch: true });

    const app = await buildApp();
    const pages = (await app.inject({ method: "GET", url: "/api/pages" })).json() as Array<{ slug: string; isHiddenFromSearch: boolean }>;
    await app.close();

    expect(pages.find((p) => p.slug === slug)?.isHiddenFromSearch).toBe(true);
  });

  it("should switch the flag from the admin, and keep it when the request leaves it out", async () => {
    const { id } = await publishedPage();
    const admin = await buildAdminApp();

    await admin.inject({ method: "PUT", url: `/api/admin/pages/${id}`, payload: { isHiddenFromSearch: true } });
    await admin.inject({ method: "PUT", url: `/api/admin/pages/${id}`, payload: { titleFr: "Consignes du jour J" } });
    await admin.close();

    const stored = await prisma.contentPage.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({ isHiddenFromSearch: true, titleFr: "Consignes du jour J" });
  });
});
