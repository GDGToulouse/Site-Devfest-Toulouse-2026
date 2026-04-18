import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import { parseIdParam, notFound } from "../../lib/admin-helpers.js";

interface PageBody {
  slug: string;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
}

export default async function adminPageRoutes(app: FastifyInstance) {
  // GET /api/admin/pages — list all content pages
  app.get("/pages", async () => {
    const pages = await prisma.contentPage.findMany({
      orderBy: { slug: "asc" },
    });

    return pages.map((p: (typeof pages)[number]) => ({
      id: p.id,
      slug: p.slug,
      titleFr: p.titleFr,
      titleEn: p.titleEn,
      updatedAt: p.updatedAt,
    }));
  });

  // GET /api/admin/pages/:id
  app.get<{ Params: { id: string } }>("/pages/:id", async (request, reply) => {
    const id = await parseIdParam(request, reply);
    if (id === null) return;

    const page = await prisma.contentPage.findUnique({ where: { id } });
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

    const existing = await prisma.contentPage.findUnique({ where: { id } });
    if (!existing) return notFound(reply, "Page");

    const body = request.body;

    const page = await prisma.contentPage.update({
      where: { id },
      data: {
        titleFr: body.titleFr?.trim() ?? existing.titleFr,
        titleEn: body.titleEn?.trim() ?? existing.titleEn,
        contentFr: body.contentFr !== undefined ? sanitizeRichHtml(body.contentFr) : existing.contentFr,
        contentEn: body.contentEn !== undefined ? sanitizeRichHtml(body.contentEn) : existing.contentEn,
      },
    });

    return { id: page.id, slug: page.slug };
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
      },
    });

    return reply.status(201).send({ id: page.id, slug: page.slug });
  });
}
