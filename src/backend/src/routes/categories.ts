import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { notDeleted } from "../lib/admin-helpers.js";

export default async function categoryRoutes(app: FastifyInstance) {
  // GET /api/categories — tracks of the featured edition (used by session filters).
  app.get("/categories", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    return prisma.category.findMany({
      where: { editionId: edition.id, ...notDeleted },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameFr: true, nameEn: true, color: true },
    });
  });
}
