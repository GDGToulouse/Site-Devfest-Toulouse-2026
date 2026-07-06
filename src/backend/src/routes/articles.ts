import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

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
      ...(editionId
        ? { OR: [{ editions: { some: { id: editionId } } }, { editions: { none: {} } }] }
        : {}),
    };

    const articles = await prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: { tags: true },
    });

    return articles.map(mapArticleSummary);
  });

  // GET /api/articles?page=1&limit=9&tag=slug — paginated list of published articles
  app.get<{
    Querystring: { page?: string; limit?: string; tag?: string };
  }>("/articles", async (request) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const limit = Math.min(Number(request.query.limit) || 12, 50);
    const tagSlug = request.query.tag;

    const where = {
      publicationStatus: "PUBLISHED" as const,
      ...(tagSlug ? { tags: { some: { slug: tagSlug } } } : {}),
    };

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { tags: true },
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
    const article = await prisma.article.findUnique({
      where: { slug: request.params.slug },
      include: { tags: true },
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
      orderBy: { name: "asc" },
    });
    return tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }));
  });
}
