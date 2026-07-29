import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateConferences } from "../../lib/revalidate.js";
import { notDeleted, notFound, parkUniqueValue, softDeleteData } from "../../lib/admin-helpers.js";

// Since #338 a category is a global track: `editionIds` says which editions
// propose it, and the per-edition display order lives on the join.
interface CategoryCreateBody {
  nameFr: string;
  nameEn: string;
  color?: string;
  editionIds?: number[];
}

type CategoryUpdateBody = Partial<CategoryCreateBody>;

interface CategoryIdParams {
  id: string;
}

interface CategoryListQuery {
  editionId?: string;
}

/** Shape returned to the admin: the track plus the editions proposing it. */
function serialize(category: {
  id: number;
  nameFr: string;
  nameEn: string;
  color: string;
  editions: { editionId: number; sortOrder: number; edition: { id: number; year: number } }[];
}) {
  return {
    id: category.id,
    nameFr: category.nameFr,
    nameEn: category.nameEn,
    color: category.color,
    editions: category.editions
      .map((link) => ({ id: link.edition.id, year: link.edition.year, sortOrder: link.sortOrder }))
      .sort((a, b) => b.year - a.year),
  };
}

const withEditions = {
  editions: {
    select: { editionId: true, sortOrder: true, edition: { select: { id: true, year: true } } },
  },
} as const;

export default async function adminCategoryRoutes(app: FastifyInstance) {
  // GET /api/admin/categories?editionId=X — filters on the editions proposing
  // the track; omitted lists the whole catalogue.
  app.get<{ Querystring: CategoryListQuery }>("/categories", {
    schema: { querystring: { type: "object", properties: { editionId: { type: "string" } } } },
  }, async (request) => {
    const { editionId } = request.query;

    const categories = await prisma.category.findMany({
      where: {
        ...notDeleted,
        ...(editionId ? { editions: { some: { editionId: Number(editionId) } } } : {}),
      },
      include: withEditions,
      orderBy: { nameFr: "asc" },
    });

    return categories.map(serialize);
  });

  // GET /api/admin/categories/:id
  app.get<{ Params: CategoryIdParams }>("/categories/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const category = await prisma.category.findFirst({
      where: { id: Number(request.params.id), ...notDeleted },
      include: withEditions,
    });
    if (!category) return reply.code(404).send({ error: "Category not found" });
    return serialize(category);
  });

  // POST /api/admin/categories
  app.post<{ Body: CategoryCreateBody }>("/categories", async (request, reply) => {
    const body = request.body;
    if (!body.nameFr?.trim() || !body.nameEn?.trim()) {
      return reply.code(400).send({ error: "nameFr and nameEn are required" });
    }

    const nameFr = body.nameFr.trim();
    // The name identifies the track globally (#338), so a duplicate is a
    // conflict rather than a second row. Trashed rows still hold their name.
    const existing = await prisma.category.findUnique({ where: { nameFr } });
    if (existing) {
      return reply.code(409).send({ error: "Une catégorie porte déjà ce nom." });
    }

    const editionIds = body.editionIds ?? [];
    if (editionIds.length && !(await editionsExist(editionIds))) {
      return reply.code(422).send({ error: "Édition inconnue." });
    }

    const category = await prisma.category.create({
      data: {
        nameFr,
        nameEn: body.nameEn.trim(),
        color: body.color || "#109E6E",
        editions: {
          create: editionIds.map((editionId, index) => ({ editionId, sortOrder: index })),
        },
      },
      include: withEditions,
    });

    revalidateConferences();
    return reply.code(201).send(serialize(category));
  });

  // PUT /api/admin/categories/:id
  app.put<{ Params: CategoryIdParams; Body: CategoryUpdateBody }>("/categories/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const body = request.body;

    const current = await prisma.category.findFirst({ where: { id, ...notDeleted } });
    if (!current) return notFound(reply, "Category");

    const nameFr = body.nameFr?.trim();
    if (nameFr && nameFr !== current.nameFr) {
      const clash = await prisma.category.findUnique({ where: { nameFr } });
      if (clash) return reply.code(409).send({ error: "Une catégorie porte déjà ce nom." });
    }

    if (body.editionIds && body.editionIds.length && !(await editionsExist(body.editionIds))) {
      return reply.code(422).send({ error: "Édition inconnue." });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(nameFr !== undefined && { nameFr }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn.trim() }),
        ...(body.color !== undefined && { color: body.color }),
        // Editions are replaced wholesale when provided: the form always sends
        // the full selection, and a diff would silently keep stale links.
        ...(body.editionIds !== undefined && {
          editions: {
            deleteMany: { categoryId: id, editionId: { notIn: body.editionIds } },
            upsert: body.editionIds.map((editionId, index) => ({
              where: { editionId_categoryId: { editionId, categoryId: id } },
              create: { editionId, sortOrder: index },
              update: { sortOrder: index },
            })),
          },
        }),
      },
      include: withEditions,
    });

    revalidateConferences();
    return serialize(category);
  });

  // DELETE /api/admin/categories/:id
  app.delete<{ Params: CategoryIdParams }>("/categories/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const categoryId = Number(request.params.id);
    const category = await prisma.category.findFirst({ where: { id: categoryId, ...notDeleted } });
    if (!category) return notFound(reply, "Category");

    // nameFr is unique globally since #338, and a trashed row keeps holding it.
    // Park it so the same track can be recreated while this one waits in the
    // trash; the restore path strips the prefix back off.
    await prisma.category.update({
      where: { id: categoryId },
      data: { ...softDeleteData(), nameFr: parkUniqueValue(category.nameFr, categoryId) },
    });
    revalidateConferences();
    return reply.code(204).send();
  });
}

async function editionsExist(ids: number[]): Promise<boolean> {
  const count = await prisma.edition.count({ where: { id: { in: ids }, ...notDeleted } });
  return count === ids.length;
}
