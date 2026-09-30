import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import {
  parseIdParam,
  notFound,
  notDeleted,
  softDeleteData,
  parkUniqueValue,
} from "../../lib/admin-helpers.js";
import { revalidateContentPage } from "../../lib/revalidate.js";

// Two pages are served by their own hardcoded routes and linked from the footer
// on every page. Trashing one would leave a 404 behind a permanent link, so the
// delete is refused rather than undone afterwards — same call as blocking the
// removal of a venue still attached to an edition (#105).
const SYSTEM_SLUGS = ["code-de-conduite", "mentions-legales"] as const;

type NavLocation = "NONE" | "HEADER" | "FOOTER";
const NAV_LOCATIONS: readonly NavLocation[] = ["NONE", "HEADER", "FOOTER"];

interface PageBody {
  slug: string;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  isPublished?: boolean;
  navLocation?: NavLocation;
  navOrder?: number;
}

// The navigation location comes from a select, but it reaches Prisma as an enum
// value: an unknown string would throw a 500 rather than a 400 (#420).
function readNavLocation(value: unknown, fallback: NavLocation): NavLocation {
  return NAV_LOCATIONS.includes(value as NavLocation) ? (value as NavLocation) : fallback;
}

export default async function adminPageRoutes(app: FastifyInstance) {
  // GET /api/admin/pages — list all content pages
  app.get("/pages", async () => {
    const pages = await prisma.contentPage.findMany({
      where: notDeleted,
      orderBy: { slug: "asc" },
    });

    return pages.map((p: (typeof pages)[number]) => ({
      id: p.id,
      slug: p.slug,
      titleFr: p.titleFr,
      titleEn: p.titleEn,
      isPublished: p.isPublished,
      navLocation: p.navLocation,
      navOrder: p.navOrder,
      updatedAt: p.updatedAt,
    }));
  });

  // GET /api/admin/pages/:id
  app.get<{ Params: { id: string } }>("/pages/:id", async (request, reply) => {
    const id = await parseIdParam(request, reply);
    if (id === null) return;

    const page = await prisma.contentPage.findFirst({ where: { id, ...notDeleted } });
    if (!page) return notFound(reply, "Page");

    return page;
  });

  // PUT /api/admin/pages/:id
  app.put<{
    Params: { id: string };
    Body: PageBody;
  }>("/pages/:id", async (request, reply) => {
    const id = await parseIdParam(request, reply);
    if (id === null) return;

    const existing = await prisma.contentPage.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Page");

    const body = request.body;

    const isSystemPage = (SYSTEM_SLUGS as readonly string[]).includes(existing.slug);
    if (isSystemPage && body.isPublished === false) {
      return reply.status(409).send({
        error: "Cette page est servie par une route dédiée et ne peut pas être dépubliée.",
      });
    }

    const page = await prisma.contentPage.update({
      where: { id },
      data: {
        titleFr: body.titleFr?.trim() ?? existing.titleFr,
        titleEn: body.titleEn?.trim() ?? existing.titleEn,
        contentFr: body.contentFr !== undefined ? sanitizeRichHtml(body.contentFr) : existing.contentFr,
        contentEn: body.contentEn !== undefined ? sanitizeRichHtml(body.contentEn) : existing.contentEn,
        isPublished: body.isPublished ?? existing.isPublished,
        navLocation: readNavLocation(body.navLocation, existing.navLocation),
        navOrder: Number.isFinite(body.navOrder) ? Number(body.navOrder) : existing.navOrder,
      },
    });

    await revalidateContentPage(page.slug);
    return { id: page.id, slug: page.slug, isPublished: page.isPublished };
  });

  // POST /api/admin/pages — create content page
  app.post<{ Body: PageBody }>("/pages", async (request, reply) => {
    const body = request.body;

    if (!body.slug?.trim() || !body.titleFr?.trim() || !body.titleEn?.trim()) {
      return reply.status(400).send({ error: "slug, titleFr, titleEn are required" });
    }

    const existing = await prisma.contentPage.findUnique({ where: { slug: body.slug.trim() } });
    if (existing) return reply.status(409).send({ error: "A page with this slug already exists" });

    const page = await prisma.contentPage.create({
      data: {
        slug: body.slug.trim(),
        titleFr: body.titleFr.trim(),
        titleEn: body.titleEn.trim(),
        contentFr: sanitizeRichHtml(body.contentFr),
        contentEn: sanitizeRichHtml(body.contentEn),
        // A new page is a draft: publishing is a deliberate second gesture.
        isPublished: body.isPublished === true,
      },
    });

    if (page.isPublished) await revalidateContentPage(page.slug);
    return reply.status(201).send({ id: page.id, slug: page.slug });
  });

  // DELETE /api/admin/pages/:id — moves the page to the trash (#419). There was
  // no delete route at all: a page created by mistake could not be taken down.
  app.delete<{ Params: { id: string } }>("/pages/:id", async (request, reply) => {
    const id = await parseIdParam(request, reply);
    if (id === null) return;

    const existing = await prisma.contentPage.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Page");

    if ((SYSTEM_SLUGS as readonly string[]).includes(existing.slug)) {
      return reply.status(409).send({
        error: "Cette page est servie par une route dédiée et ne peut pas être supprimée.",
      });
    }

    // The slug is globally unique and a trashed row keeps its slot, so park it
    // out of the live namespace — otherwise re-creating a page under the same
    // slug would hit the constraint (#146).
    await prisma.contentPage.update({
      where: { id },
      data: { ...softDeleteData(), slug: parkUniqueValue(existing.slug, id) },
    });

    await revalidateContentPage(existing.slug);
    return { success: true };
  });
}
