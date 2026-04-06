import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function pageRoutes(app: FastifyInstance) {
  // GET /api/pages/:slug — returns a content page (CoC, Legal, etc.)
  app.get<{
    Params: { slug: string };
  }>("/pages/:slug", async (request, reply) => {
    const page = await prisma.contentPage.findUnique({
      where: { slug: request.params.slug },
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
