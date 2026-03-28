import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function articleRoutes(app: FastifyInstance) {
  // GET /api/articles/latest?limit=4 — returns the N most recent published articles
  app.get<{
    Querystring: { limit?: string };
  }>("/articles/latest", async (request) => {
    const limit = Math.min(Number(request.query.limit) || 4, 20);

    const articles = await prisma.article.findMany({
      where: { publicationStatus: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: { tags: true },
    });

    return articles.map((article) => ({
      id: article.id,
      slug: article.slug,
      titleFr: article.titleFr,
      titleEn: article.titleEn,
      excerptFr: article.excerptFr,
      excerptEn: article.excerptEn,
      imageUrl: article.imageUrl,
      author: article.author,
      publishedAt: article.publishedAt,
      tags: article.tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
    }));
  });
}
