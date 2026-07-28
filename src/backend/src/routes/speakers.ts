import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { notDeleted, parseSocialLinks } from "../lib/admin-helpers.js";

export default async function speakerRoutes(app: FastifyInstance) {
  // GET /api/speakers — published speakers of the featured edition, alphabetical.
  app.get("/speakers", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    // Read through the participations since #351, then project back to the
    // exact same response shape: the public payload must not change.
    const links = await prisma.speakerEdition.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED", speaker: notDeleted },
      orderBy: { speaker: { name: "asc" } },
      select: {
        isFeatured: true,
        speaker: {
          select: { id: true, slug: true, name: true, photoUrl: true, company: true },
        },
      },
    });
    return links.map((link) => ({ ...link.speaker, isFeatured: link.isFeatured }));
  });

  // GET /api/speakers/featured — published + featured speakers (home section, US-202).
  app.get("/speakers/featured", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    const links = await prisma.speakerEdition.findMany({
      where: {
        editionId: edition.id,
        publicationStatus: "PUBLISHED",
        isFeatured: true,
        speaker: notDeleted,
      },
      orderBy: { speaker: { name: "asc" } },
      take: 8,
      select: {
        speaker: { select: { id: true, slug: true, name: true, photoUrl: true, company: true } },
      },
    });
    return links.map((link) => link.speaker);
  });

  // GET /api/speakers/:slug — detail of a published speaker + its published talks.
  app.get<{ Params: { slug: string } }>("/speakers/:slug", {
    schema: {
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
    },
  }, async (request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    // The slug identifies the person (#351); the participation decides whether
    // they are public on this edition.
    const speaker = await prisma.speaker.findFirst({
      where: {
        slug: request.params.slug,
        ...notDeleted,
        editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
      },
      include: {
        // Nested reads need their own filter: a query extension would not reach
        // them (Prisma applies those to the top-level operation only), and a
        // trashed talk would otherwise still show up on a live speaker page.
        // Scoped to the edition since #351, or a global identity would drag
        // every past year's sessions onto this page.
        talks: {
          where: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
          select: { slug: true, title: true, format: true },
          orderBy: { title: "asc" },
        },
        sponsor: { select: { slug: true, name: true } },
      },
    });

    if (!speaker) return reply.status(404).send({ error: "Speaker not found" });

    return {
      id: speaker.id,
      slug: speaker.slug,
      name: speaker.name,
      photoUrl: speaker.photoUrl,
      company: speaker.company,
      city: speaker.city,
      bioFr: speaker.bioFr,
      bioEn: speaker.bioEn,
      socialLinks: parseSocialLinks(speaker.socialLinks),
      sponsor: speaker.sponsor,
      talks: speaker.talks,
    };
  });
}
