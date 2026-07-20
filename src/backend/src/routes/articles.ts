import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { notDeleted } from "../lib/admin-helpers.js";

function mapArticleSummary(article: {
  id: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string | null;
  excerptEn: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date | null;
  tags: { id: number; name: string; slug: string }[];
}) {
  return {
    id: article.id,
    slug: article.slug,
    titleFr: article.titleFr,
    titleEn: article.titleEn,
    excerptFr: article.excerptFr,
    excerptEn: article.excerptEn,
    imageUrl: article.imageUrl,
    author: article.author,
    publishedAt: article.publishedAt,
    tags: article.tags.map((tag: (typeof article.tags)[number]) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
  };
}

export default async function articleRoutes(app: FastifyInstance) {
  // GET /api/articles/latest?limit=4&editionId=1 — returns the N most recent published articles
  // If editionId is provided, returns articles linked to that edition OR to no edition
  app.get<{
    Querystring: { limit?: string; editionId?: string };
  }>("/articles/latest", async (request) => {
    const limit = Math.min(Number(request.query.limit) || 4, 20);
    const editionId = request.query.editionId ? Number(request.query.editionId) : null;

    const where = {
      publicationStatus: "PUBLISHED" as const,
      ...notDeleted,
      ...(editionId
        ? { OR: [{ editions: { some: { id: editionId } } }, { editions: { none: {} } }] }
        : {}),
    };

    const articles = await prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
      // Nested reads need their own filter: a query extension would not reach
      // them (Prisma applies those to the top-level operation only), and a
      // trashed tag would otherwise still show up on a live article.
      include: { tags: { where: notDeleted } },
    });

    return articles.map(mapArticleSummary);
  });

  // GET /api/articles?page=1&limit=9&tag=slug&editionId=2 — paginated list of
  // published articles. `editionId` filters strictly on articles attached to
  // that edition — unlike /articles/latest, which also pulls in the ones with
  // no edition at all. A page titled "articles of the 2025 edition" should not
  // show articles that belong to no edition (#178).
  app.get<{
    Querystring: { page?: string; limit?: string; tag?: string; editionId?: string };
  }>("/articles", async (request) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const limit = Math.min(Number(request.query.limit) || 12, 50);
    const tagSlug = request.query.tag;
    const editionId = Number(request.query.editionId) || undefined;

    const where = {
      publicationStatus: "PUBLISHED" as const,
      ...notDeleted,
      ...(tagSlug ? { tags: { some: { slug: tagSlug, ...notDeleted } } } : {}),
      ...(editionId ? { editions: { some: { id: editionId, ...notDeleted } } } : {}),
    };

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { tags: { where: notDeleted } },
      }),
      prisma.article.count({ where }),
    ]);

    return {
      articles: articles.map(mapArticleSummary),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  });

  // GET /api/articles/:slug — single article detail
  app.get<{
    Params: { slug: string };
  }>("/articles/:slug", async (request, reply) => {
    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const article = await prisma.article.findFirst({
      where: { slug: request.params.slug, ...notDeleted },
      include: { tags: { where: notDeleted } },
    });

    if (!article || article.publicationStatus !== "PUBLISHED") {
      return reply.status(404).send({ error: "Article not found" });
    }

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
      publishedAt: article.publishedAt,
      // AI-translation transparency: front uses these to show a discreet
      // "automatic translation" notice on the relevant locale page.
      autoTranslatedFr: article.autoTranslatedFr,
      autoTranslatedEn: article.autoTranslatedEn,
      translatedAtFr: article.translatedAtFr,
      translatedAtEn: article.translatedAtEn,
      tags: article.tags.map((tag: (typeof article.tags)[number]) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
    };
  });

  // GET /api/tags — all tags
  app.get("/tags", async () => {
    const tags = await prisma.tag.findMany({
      where: notDeleted,
      orderBy: { name: "asc" },
    });
    return tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }));
  });
}
