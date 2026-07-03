import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";

// Decreasing importance order (RG-221), used to sort levels for display.
const LEVEL_ORDER: Record<string, number> = {
  PLATINUM: 0,
  GOLD: 1,
  SILVER: 2,
  SOUTIEN: 3,
  COMMUNAUTE: 4,
};

function parseSocial(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export default async function sponsorRoutes(app: FastifyInstance) {
  // GET /api/sponsors — published sponsors of the featured edition, ordered by level.
  app.get("/sponsors", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    const sponsors = await prisma.sponsor.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED" },
    });

    return sponsors
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        logoUrl: s.logoUrl,
        level: s.level,
        websiteUrl: s.websiteUrl,
      }))
      .sort((a, b) => (LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]) || a.name.localeCompare(b.name));
  });

  // GET /api/sponsors/:slug — detail of a published sponsor + its speakers (RG-226).
  app.get<{ Params: { slug: string } }>("/sponsors/:slug", {
    schema: {
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
    },
  }, async (request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    const sponsor = await prisma.sponsor.findFirst({
      where: { editionId: edition.id, slug: request.params.slug, publicationStatus: "PUBLISHED" },
      include: {
        speakers: {
          where: { publicationStatus: "PUBLISHED" },
          select: { slug: true, name: true, photoUrl: true, company: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!sponsor) return reply.status(404).send({ error: "Sponsor not found" });

    return {
      id: sponsor.id,
      slug: sponsor.slug,
      name: sponsor.name,
      logoUrl: sponsor.logoUrl,
      level: sponsor.level,
      websiteUrl: sponsor.websiteUrl,
      descriptionFr: sponsor.descriptionFr,
      descriptionEn: sponsor.descriptionEn,
      socialLinks: parseSocial(sponsor.socialLinks),
      speakers: sponsor.speakers,
    };
  });
}
