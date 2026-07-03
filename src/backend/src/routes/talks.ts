import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";

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
      where: { editionId: edition.id, slug: request.params.slug, publicationStatus: "PUBLISHED" },
      include: {
        speakers: {
          where: { publicationStatus: "PUBLISHED" },
          select: { slug: true, name: true, photoUrl: true, company: true },
          orderBy: { name: "asc" },
        },
        category: { select: { nameFr: true, nameEn: true, color: true } },
      },
    });

    if (!talk) return reply.status(404).send({ error: "Talk not found" });

    return {
      id: talk.id,
      slug: talk.slug,
      titleFr: talk.titleFr,
      titleEn: talk.titleEn,
      descriptionFr: talk.descriptionFr,
      descriptionEn: talk.descriptionEn,
      format: talk.format,
      level: talk.level,
      language: talk.language,
      category: talk.category,
      speakers: talk.speakers,
    };
  });
}
