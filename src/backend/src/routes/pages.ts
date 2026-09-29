import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

// Only a published, non-trashed page is public (#419). Both conditions matter:
// a draft must never be served, and a trashed row keeps its slug until it is
// purged, so it would otherwise still answer on its URL.
const publiclyVisible = { isPublished: true, deletedAt: null } as const;

export default async function pageRoutes(app: FastifyInstance) {
  // GET /api/pages — published pages, for the sitemap and the navigation.
  // Content is left out: callers here want the list, not the bodies.
  app.get("/pages", async () => {
    const pages = await prisma.contentPage.findMany({
      where: publiclyVisible,
      // Navigation order first, so the header and footer can render the list as
      // it comes; the slug only breaks ties between pages left at the same rank.
      orderBy: [{ navOrder: "asc" }, { slug: "asc" }],
    });

    return pages.map((p: (typeof pages)[number]) => ({
      id: p.id,
      slug: p.slug,
      titleFr: p.titleFr,
      titleEn: p.titleEn,
      hasEnglish: p.titleEn.trim().length > 0 && p.contentEn.trim().length > 0,
      navLocation: p.navLocation,
      navOrder: p.navOrder,
      updatedAt: p.updatedAt,
    }));
  });

  // GET /api/pages/:slug — returns a content page (CoC, Legal, admin-authored)
  app.get<{
    Params: { slug: string };
  }>("/pages/:slug", async (request, reply) => {
    const page = await prisma.contentPage.findFirst({
      where: { slug: request.params.slug, ...publiclyVisible },
    });

    if (!page) {
      return reply.status(404).send({ error: "Page not found" });
    }

    return {
      id: page.id,
      slug: page.slug,
      titleFr: page.titleFr,
      titleEn: page.titleEn,
      contentFr: page.contentFr,
      contentEn: page.contentEn,
      updatedAt: page.updatedAt,
    };
  });
}
