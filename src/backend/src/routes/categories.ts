import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { notDeleted } from "../lib/admin-helpers.js";

export default async function categoryRoutes(app: FastifyInstance) {
  // GET /api/categories — tracks of the featured edition (used by session filters).
  app.get("/categories", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    // Categories are global since #338; the edition binding — and the display
    // order for that year — lives on the join. Reading through it keeps the
    // response shape unchanged for the session filters.
    const links = await prisma.editionCategory.findMany({
      where: { editionId: edition.id, category: notDeleted },
      orderBy: { sortOrder: "asc" },
      select: { category: { select: { id: true, nameFr: true, nameEn: true, color: true } } },
    });
    return links.map((link) => link.category);
  });
}
