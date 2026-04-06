import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

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
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const page = await prisma.contentPage.findUnique({ where: { id } });
    if (!page) return reply.status(404).send({ error: "Page not found" });

    return page;
  });

  // PUT /api/admin/pages/:id
  app.put<{
    Params: { id: string };
    Body: PageBody;
  }>("/pages/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.contentPage.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Page not found" });

    const body = request.body;

    const page = await prisma.contentPage.update({
      where: { id },
      data: {
        titleFr: body.titleFr?.trim() ?? existing.titleFr,
        titleEn: body.titleEn?.trim() ?? existing.titleEn,
        contentFr: body.contentFr ?? existing.contentFr,
        contentEn: body.contentEn ?? existing.contentEn,
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
        contentFr: body.contentFr || "",
        contentEn: body.contentEn || "",
      },
    });

    return reply.status(201).send({ id: page.id, slug: page.slug });
  });
}
