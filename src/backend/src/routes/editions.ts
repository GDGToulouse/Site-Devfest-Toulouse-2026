import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

type TicketStatus = "AVAILABLE" | "SOLD_OUT" | "COMING_SOON";

// Resolves the effective ticket status by priority:
//   1. manualStatus — admin override, always wins when set
//   2. isSoldOut    — synced from BilletWeb (/event/:id/avail)
//   3. dates        — sale window fallback
export function computeTicketStatus(tier: {
  manualStatus?: TicketStatus | null;
  isSoldOut?: boolean | null;
  saleStartDate: Date | null;
  saleEndDate: Date | null;
}, now: Date): TicketStatus {
  if (tier.manualStatus) return tier.manualStatus;
  if (tier.isSoldOut) return "SOLD_OUT";
  if (tier.saleEndDate && tier.saleEndDate < now) return "SOLD_OUT";
  if (tier.saleStartDate && tier.saleStartDate > now) return "COMING_SOON";
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
      select: { id: true, year: true, status: true, archivedSiteUrl: true, startDate: true },
    });
    return editions;
  });

  // GET /api/editions/:year — returns full edition data by year
  app.get<{ Params: { year: string } }>("/editions/:year", {
    schema: {
      params: {
        type: "object",
        required: ["year"],
        properties: { year: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const { year } = request.params;
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

  // GET /api/editions/:year/speakers — published speakers of any edition by year
  // (issue #63: past editions history, not scoped to the featured edition).
  app.get<{ Params: { year: string } }>("/editions/:year/speakers", {
    schema: { params: { type: "object", required: ["year"], properties: { year: { type: "string" } } } },
  }, async (request, reply) => {
    const yearNum = Number(request.params.year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findUnique({ where: { year: yearNum }, select: { id: true } });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const speakers = await prisma.speaker.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED" },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, photoUrl: true, company: true },
    });
    return speakers;
  });

  // GET /api/editions/:year/talks — published talks of any edition by year,
  // with speakers, category and replay video (issue #63).
  app.get<{ Params: { year: string } }>("/editions/:year/talks", {
    schema: { params: { type: "object", required: ["year"], properties: { year: { type: "string" } } } },
  }, async (request, reply) => {
    const yearNum = Number(request.params.year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findUnique({ where: { year: yearNum }, select: { id: true } });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const talks = await prisma.talk.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED" },
      orderBy: { titleFr: "asc" },
      include: {
        speakers: {
          where: { publicationStatus: "PUBLISHED" },
          select: { slug: true, name: true },
          orderBy: { name: "asc" },
        },
        category: { select: { nameFr: true, nameEn: true, color: true } },
      },
    });

    return talks.map((t) => ({
      slug: t.slug,
      titleFr: t.titleFr,
      titleEn: t.titleEn,
      descriptionFr: t.descriptionFr,
      descriptionEn: t.descriptionEn,
      format: t.format,
      level: t.level,
      language: t.language,
      videoUrl: t.videoUrl,
      category: t.category,
      speakers: t.speakers,
    }));
  });

  // GET /api/editions/current — returns the featured edition
  app.get("/editions/current", async (_request, reply) => {
    const edition = await getFeaturedEdition();

    if (!edition) {
      return reply.status(404).send({ error: "No edition found" });
    }

    // Fetch previous edition's aftermovie + gallery + year, used by the
    // home page to link back to last edition's content during preparation
    // and announcement phases.
    const previousEdition = await prisma.edition.findFirst({
      where: { year: { lt: edition.year } },
      orderBy: { year: "desc" },
      select: { year: true, aftermovieUrl: true, galleryUrl: true },
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
      sponsorFormUrl: edition.sponsorFormUrl,
      aftermovieUrl: edition.aftermovieUrl,
      previousYear: previousEdition?.year ?? null,
      previousAfterMovieUrl: previousEdition?.aftermovieUrl || null,
      previousGalleryUrl: previousEdition?.galleryUrl || null,
      galleryUrl: edition.galleryUrl,
      archivedSiteUrl: edition.archivedSiteUrl,
      sponsorBrochureUrl: edition.sponsorBrochureUrl,
      sponsorHeroImageUrl: edition.sponsorHeroImageUrl,
      sponsorPageStatus: edition.sponsorPageStatus,
      sponsorTemporaryFormUrl: edition.sponsorTemporaryFormUrl,
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
      status: computeTicketStatus(tier, now),
      externalUrl: tier.externalUrl,
      sortOrder: tier.sortOrder,
    }));
  });
}
