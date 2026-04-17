import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateArticle } from "../../lib/revalidate.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";

interface ArticleBody {
  slug: string;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  excerptFr?: string;
  excerptEn?: string;
  imageUrl?: string;
  author?: string;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  editionIds?: number[];
  tagIds?: number[];
}

export default async function adminArticleRoutes(app: FastifyInstance) {
  // GET /api/admin/articles — list all articles (including drafts), with pagination
  app.get<{
    Querystring: { page?: string; limit?: string; status?: string };
  }>("/articles", async (request) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const limit = Math.min(Number(request.query.limit) || 20, 100);
    const status = request.query.status;

    const where = status ? { publicationStatus: status as "DRAFT" | "PUBLISHED" } : {};

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: { tags: true, editions: true },
      }),
      prisma.article.count({ where }),
    ]);

    return {
      articles: articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        titleFr: a.titleFr,
        titleEn: a.titleEn,
        excerptFr: a.excerptFr,
        excerptEn: a.excerptEn,
        imageUrl: a.imageUrl,
        author: a.author,
        publicationStatus: a.publicationStatus,
        publishedAt: a.publishedAt,
        createdAt: a.createdAt,
        tags: a.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
        editions: a.editions.map((e: { id: number; year: number }) => ({ id: e.id, year: e.year })),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  });

  // GET /api/admin/articles/:id — single article for editing
  app.get<{
    Params: { id: string };
  }>("/articles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const article = await prisma.article.findUnique({
      where: { id },
      include: { tags: true, editions: true },
    });

    if (!article) return reply.status(404).send({ error: "Article not found" });

    return {
      id: article.id,
      slug: article.slug,
      titleFr: article.titleFr,
      titleEn: article.titleEn,
      contentFr: article.contentFr,
      contentEn: article.contentEn,
      excerptFr: article.excerptFr,
      excerptEn: article.excerptEn,
      imageUrl: article.imageUrl,
      author: article.author,
      publicationStatus: article.publicationStatus,
      publishedAt: article.publishedAt,
      editions: article.editions.map((e: { id: number; year: number }) => ({ id: e.id, year: e.year })),
      tags: article.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    };
  });

  // POST /api/admin/articles — create article
  app.post<{ Body: ArticleBody }>("/articles", async (request, reply) => {
    const body = request.body;

    if (!body.slug?.trim() || !body.titleFr?.trim() || !body.titleEn?.trim()) {
      return reply.status(400).send({ error: "slug, titleFr, titleEn are required" });
    }

    const existing = await prisma.article.findUnique({ where: { slug: body.slug.trim() } });
    if (existing) {
      return reply.status(409).send({ error: "An article with this slug already exists" });
    }

    const isPublished = body.publicationStatus === "PUBLISHED";

    const article = await prisma.article.create({
      data: {
        slug: body.slug.trim(),
        titleFr: body.titleFr.trim(),
        titleEn: body.titleEn.trim(),
        contentFr: sanitizeRichHtml(body.contentFr),
        contentEn: sanitizeRichHtml(body.contentEn),
        excerptFr: body.excerptFr?.trim() || null,
        excerptEn: body.excerptEn?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        author: body.author?.trim() || null,
        publicationStatus: body.publicationStatus || "DRAFT",
        publishedAt: isPublished ? new Date() : null,
        editions: body.editionIds?.length ? { connect: body.editionIds.map((id) => ({ id })) } : undefined,
        tags: body.tagIds?.length ? { connect: body.tagIds.map((id) => ({ id })) } : undefined,
      },
      include: { tags: true },
    });

    revalidateArticle(article.slug);
    return reply.status(201).send({ id: article.id, slug: article.slug });
  });

  // PUT /api/admin/articles/:id — update article
  app.put<{
    Params: { id: string };
    Body: ArticleBody;
  }>("/articles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Article not found" });

    const body = request.body;
    const isPublished = body.publicationStatus === "PUBLISHED";
    const wasPublished = existing.publicationStatus === "PUBLISHED";

    const article = await prisma.article.update({
      where: { id },
      data: {
        slug: body.slug?.trim() || existing.slug,
        titleFr: body.titleFr?.trim() || existing.titleFr,
        titleEn: body.titleEn?.trim() || existing.titleEn,
        contentFr: body.contentFr !== undefined ? sanitizeRichHtml(body.contentFr) : existing.contentFr,
        contentEn: body.contentEn !== undefined ? sanitizeRichHtml(body.contentEn) : existing.contentEn,
        excerptFr: body.excerptFr?.trim() ?? existing.excerptFr,
        excerptEn: body.excerptEn?.trim() ?? existing.excerptEn,
        imageUrl: body.imageUrl?.trim() ?? existing.imageUrl,
        author: body.author?.trim() ?? existing.author,
        publicationStatus: body.publicationStatus || existing.publicationStatus,
        publishedAt: isPublished && !wasPublished ? new Date() : existing.publishedAt,
        editions: body.editionIds !== undefined
          ? { set: body.editionIds.map((editionId) => ({ id: editionId })) }
          : undefined,
        tags: body.tagIds !== undefined
          ? { set: body.tagIds.map((tagId) => ({ id: tagId })) }
          : undefined,
      },
      include: { tags: true },
    });

    // Revalidate both the old and new slug if renamed
    revalidateArticle(article.slug);
    if (existing.slug !== article.slug) revalidateArticle(existing.slug);
    return { id: article.id, slug: article.slug };
  });

  // DELETE /api/admin/articles/:id
  app.delete<{
    Params: { id: string };
  }>("/articles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Article not found" });

    await prisma.article.delete({ where: { id } });
    revalidateArticle(existing.slug);
    return { success: true };
  });

  // GET /api/admin/tags — list all tags
  app.get("/tags", async () => {
    return prisma.tag.findMany({ orderBy: { name: "asc" } });
  });

  // POST /api/admin/tags — create a tag
  app.post<{
    Body: { name: string };
  }>("/tags", async (request, reply) => {
    const name = request.body.name?.trim();
    if (!name) return reply.status(400).send({ error: "name is required" });

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) return reply.status(409).send({ error: "Tag already exists" });

    const tag = await prisma.tag.create({ data: { name, slug } });
    return reply.status(201).send(tag);
  });

  // DELETE /api/admin/tags/:id
  app.delete<{
    Params: { id: string };
  }>("/tags/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    await prisma.tag.delete({ where: { id } });
    return { success: true };
  });
}
