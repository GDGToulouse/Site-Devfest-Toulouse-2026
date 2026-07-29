import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { notDeleted, visibleCategory } from "../lib/admin-helpers.js";

export default async function talkRoutes(app: FastifyInstance) {
  // GET /api/talks/:slug — detail of a published talk + its published speakers
  // and category. The full programme grid (rooms, time slots) is Lot 3.
  app.get<{ Params: { slug: string } }>("/talks/:slug", {
    schema: {
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
    },
  }, async (request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    const talk = await prisma.talk.findFirst({
      where: {
        editionId: edition.id,
        slug: request.params.slug,
        publicationStatus: "PUBLISHED",
        ...notDeleted,
      },
      include: {
        // Nested reads need their own filter: a query extension would not reach
        // them (Prisma applies those to the top-level operation only), and a
        // trashed speaker would otherwise still show up on a live talk page.
        speakers: {
          // Published *for this edition* (#351): the status moved onto the
          // participation, so the filter goes through it.
          where: {
            ...notDeleted,
            editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
          },
          select: { slug: true, name: true, photoUrl: true, company: true },
          orderBy: { name: "asc" },
        },
        // `category` is to-one: Prisma takes no `where` there, so a trashed
        // category cannot be filtered out by the query. `deletedAt` comes along
        // and the serializer below drops it (#147).
        category: { select: { nameFr: true, nameEn: true, color: true, deletedAt: true } },
      },
    });

    if (!talk) return reply.status(404).send({ error: "Talk not found" });

    return {
      id: talk.id,
      slug: talk.slug,
      title: talk.title,
      description: talk.description,
      format: talk.format,
      level: talk.level,
      language: talk.language,
      category: visibleCategory(talk.category),
      speakers: talk.speakers,
    };
  });
}
