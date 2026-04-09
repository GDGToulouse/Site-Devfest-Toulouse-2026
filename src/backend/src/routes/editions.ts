import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export function computeTicketStatus(
  saleStartDate: Date | null,
  saleEndDate: Date | null,
  now: Date,
): "AVAILABLE" | "SOLD_OUT" | "COMING_SOON" {
  if (saleEndDate && saleEndDate < now) return "SOLD_OUT";
  if (saleStartDate && saleStartDate > now) return "COMING_SOON";
  return "AVAILABLE";
}

export async function getFeaturedEdition() {
  // 1. Check SiteSetting for featured_edition_id
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "featured_edition_id" },
  });

  if (setting) {
    const edition = await prisma.edition.findUnique({
      where: { id: Number(setting.value) },
    });
    if (edition) return edition;
  }

  // 2. Fallback: latest edition by year
  return prisma.edition.findFirst({
    orderBy: { year: "desc" },
  });
}

export default async function editionRoutes(app: FastifyInstance) {
  // GET /api/editions — returns all editions (summary)
  app.get("/editions", async () => {
    const editions = await prisma.edition.findMany({
      orderBy: { year: "desc" },
      select: { id: true, year: true, status: true, archivedSiteUrl: true },
    });
    return editions;
  });

  // GET /api/editions/:year — returns full edition data by year
  app.get("/editions/:year", async (request, reply) => {
    const { year } = request.params as { year: string };
    const yearNum = Number(year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findUnique({
      where: { year: yearNum },
      include: {
        keyFigures: { orderBy: { sortOrder: "asc" } },
        articles: {
          where: { publicationStatus: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
          take: 4,
          include: { tags: true },
        },
      },
    });

    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    return {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      status: edition.status,
      venueName: edition.venueName,
      venueAddress: edition.venueAddress,
      heroImageUrl: edition.heroImageUrl,
      aftermovieUrl: edition.aftermovieUrl,
      galleryUrl: edition.galleryUrl,
      archivedSiteUrl: edition.archivedSiteUrl,
      keyFigures: edition.keyFigures.map((kf) => ({
        icon: kf.icon,
        value: kf.value,
        labelFr: kf.labelFr,
        labelEn: kf.labelEn,
      })),
      articles: edition.articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        titleFr: a.titleFr,
        titleEn: a.titleEn,
        excerptFr: a.excerptFr,
        excerptEn: a.excerptEn,
        imageUrl: a.imageUrl,
        author: a.author,
        publishedAt: a.publishedAt,
        tags: a.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      })),
    };
  });

  // GET /api/editions/current — returns the featured edition
  app.get("/editions/current", async (_request, reply) => {
    const edition = await getFeaturedEdition();

    if (!edition) {
      return reply.status(404).send({ error: "No edition found" });
    }

    // Fetch previous edition's aftermovie
    const previousEdition = await prisma.edition.findFirst({
      where: { year: { lt: edition.year } },
      orderBy: { year: "desc" },
      select: { aftermovieUrl: true },
    });

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
      previousAfterMovieUrl: previousEdition?.aftermovieUrl || null,
      galleryUrl: edition.galleryUrl,
      archivedSiteUrl: edition.archivedSiteUrl,
      // TODO: compute from actual data when Speaker/Session/Sponsor models exist
      isProgramPublished: false,
      hasSpeakers: false,
      hasSponsors: false,
    };
  });

  // GET /api/editions/current/sponsor-plans — returns visible plans for the featured edition
  app.get("/editions/current/sponsor-plans", async (_request, reply) => {
    const edition = await getFeaturedEdition();

    if (!edition) {
      return reply.status(404).send({ error: "No edition found" });
    }

    const plans = await prisma.sponsorPlan.findMany({
      where: {
        editionId: edition.id,
        isVisible: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    return plans.map((p) => ({
      id: p.id,
      nameFr: p.nameFr,
      nameEn: p.nameEn,
      subtitleFr: p.subtitleFr,
      subtitleEn: p.subtitleEn,
      descriptionFr: p.descriptionFr,
      descriptionEn: p.descriptionEn,
      price: p.price,
      standSize: p.standSize,
      advantages: p.advantages ? JSON.parse(p.advantages) : [],
      color: p.color,
      isFeatured: p.isFeatured,
    }));
  });

  // GET /api/editions/current/ticket-tiers — returns visible tiers for the featured edition
  app.get("/editions/current/ticket-tiers", async (_request, reply) => {
    const edition = await getFeaturedEdition();

    if (!edition) {
      return reply.status(404).send({ error: "No edition found" });
    }

    const tiers = await prisma.ticketTier.findMany({
      where: {
        editionId: edition.id,
        isVisible: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    const now = new Date();

    return tiers.map((tier: (typeof tiers)[number]) => ({
      id: tier.id,
      nameFr: tier.nameFr,
      nameEn: tier.nameEn,
      price: Number(tier.price),
      status: computeTicketStatus(tier.saleStartDate, tier.saleEndDate, now),
      externalUrl: tier.externalUrl,
      sortOrder: tier.sortOrder,
    }));
  });
}
