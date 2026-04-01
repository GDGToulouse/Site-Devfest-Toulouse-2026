import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

async function getFeaturedEdition() {
  // Priority: edition with ANNOUNCEMENT status, fallback to latest by year
  const edition =
    (await prisma.edition.findFirst({
      where: { status: "ANNOUNCEMENT" },
    })) ??
    (await prisma.edition.findFirst({
      orderBy: { year: "desc" },
    }));

  return edition;
}

export default async function editionRoutes(app: FastifyInstance) {
  // GET /api/editions/current — returns the featured edition (ANNOUNCEMENT first, then latest)
  app.get("/editions/current", async (_request, reply) => {
    const edition = await getFeaturedEdition();

    if (!edition) {
      return reply.status(404).send({ error: "No edition found" });
    }

    return {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      status: edition.status,
      venueName: edition.venueName,
      venueAddress: edition.venueAddress,
      heroImageUrl: edition.heroImageUrl,
      cfpUrl: edition.cfpUrl,
      partnerFormUrl: edition.partnerFormUrl,
      aftermovieUrl: edition.aftermovieUrl,
      galleryUrl: edition.galleryUrl,
      archivedSiteUrl: edition.archivedSiteUrl,
    };
  });

  // GET /api/editions/current/ticket-tiers — returns active tiers for the featured edition
  app.get("/editions/current/ticket-tiers", async (_request, reply) => {
    const edition = await getFeaturedEdition();

    if (!edition) {
      return reply.status(404).send({ error: "No edition found" });
    }

    const tiers = await prisma.ticketTier.findMany({
      where: {
        editionId: edition.id,
        status: { in: ["AVAILABLE", "SOLD_OUT"] },
      },
      orderBy: { sortOrder: "asc" },
    });

    return tiers.map((tier) => ({
      id: tier.id,
      nameFr: tier.nameFr,
      nameEn: tier.nameEn,
      price: Number(tier.price),
      status: tier.status,
      externalUrl: tier.externalUrl,
      sortOrder: tier.sortOrder,
    }));
  });
}
