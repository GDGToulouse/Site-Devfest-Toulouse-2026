import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateConferences } from "../../lib/revalidate.js";

interface CategoryCreateBody {
  editionId: number;
  nameFr: string;
  nameEn: string;
  color?: string;
  sortOrder?: number;
}

type CategoryUpdateBody = Partial<Omit<CategoryCreateBody, "editionId">>;

interface CategoryIdParams {
  id: string;
}

interface CategoryListQuery {
  editionId?: string;
}

export default async function adminCategoryRoutes(app: FastifyInstance) {
  // GET /api/admin/categories?editionId=X
  app.get<{ Querystring: CategoryListQuery }>("/categories", {
    schema: { querystring: { type: "object", properties: { editionId: { type: "string" } } } },
  }, async (request, reply) => {
    const { editionId } = request.query;
    if (!editionId) return reply.code(400).send({ error: "editionId required" });

    return prisma.category.findMany({
      where: { editionId: Number(editionId) },
      orderBy: { sortOrder: "asc" },
    });
  });

  // POST /api/admin/categories
  app.post<{ Body: CategoryCreateBody }>("/categories", async (request, reply) => {
    const body = request.body;
    if (!body.editionId || !body.nameFr?.trim() || !body.nameEn?.trim()) {
      return reply.code(400).send({ error: "editionId, nameFr and nameEn are required" });
    }

    const category = await prisma.category.create({
      data: {
        editionId: body.editionId,
        nameFr: body.nameFr.trim(),
        nameEn: body.nameEn.trim(),
        color: body.color || "#109E6E",
        sortOrder: body.sortOrder ?? 0,
      },
    });

    revalidateConferences();
    return reply.code(201).send(category);
  });

  // PUT /api/admin/categories/:id
  app.put<{ Params: CategoryIdParams; Body: CategoryUpdateBody }>("/categories/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    const { id } = request.params;
    const body = request.body;

    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: {
        ...(body.nameFr !== undefined && { nameFr: body.nameFr.trim() }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn.trim() }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });

    revalidateConferences();
    return category;
  });

  // DELETE /api/admin/categories/:id
  app.delete<{ Params: CategoryIdParams }>("/categories/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const { id } = request.params;
    await prisma.category.delete({ where: { id: Number(id) } });
    revalidateConferences();
    return reply.code(204).send();
  });
}
