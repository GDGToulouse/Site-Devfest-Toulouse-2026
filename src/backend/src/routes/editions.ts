import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { areOffersVisible } from "../lib/job-offers.js";
import { notDeleted, parseSocialLinks, visibleCategory } from "../lib/admin-helpers.js";

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
    // findFirst so the trash filter fits (#147). A trashed featured edition
    // falls through to the fallback below rather than driving the whole public
    // site — this function decides what every visitor sees.
    const edition = await prisma.edition.findFirst({
      where: { id: Number(setting.value), ...notDeleted },
    });
    if (edition) return edition;
  }

  // 2. Fallback: latest edition by year
  return prisma.edition.findFirst({
    where: notDeleted,
    orderBy: { year: "desc" },
  });
}

export default async function editionRoutes(app: FastifyInstance) {
  // GET /api/editions — returns all editions (summary)
  app.get("/editions", async () => {
    const editions = await prisma.edition.findMany({
      where: notDeleted,
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

    // findFirst: findUnique cannot carry the deletedAt filter (#147). Both
    // nested levels need their own — the filter does not propagate down an
    // include, so a trashed article (or tag) would still surface here.
    const edition = await prisma.edition.findFirst({
      where: { year: yearNum, ...notDeleted },
      include: {
        keyFigures: { orderBy: { sortOrder: "asc" } },
        articles: {
          where: { publicationStatus: "PUBLISHED", ...notDeleted },
          orderBy: { publishedAt: "desc" },
          take: 4,
          include: { tags: { where: notDeleted } },
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

    const edition = await prisma.edition.findFirst({ where: { year: yearNum, ...notDeleted }, select: { id: true } });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const links = await prisma.speakerEdition.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED", speaker: notDeleted },
      orderBy: { speaker: { name: "asc" } },
      select: { speaker: { select: { slug: true, name: true, photoUrl: true, company: true } } },
    });
    return links.map((link) => link.speaker);
  });

  // GET /api/editions/:year/speakers/:slug — detail of one past speaker (#103).
  //
  // `/api/speakers/:slug` scopes to the featured edition, so a 2019 speaker
  // answers 404 there. The slug is global since #351, but the year stays in the
  // path: it selects which edition's sessions and which participation to show.
  app.get<{ Params: { year: string; slug: string } }>("/editions/:year/speakers/:slug", {
    schema: {
      params: {
        type: "object",
        required: ["year", "slug"],
        properties: { year: { type: "string" }, slug: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const yearNum = Number(request.params.year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findFirst({
      where: { year: yearNum, ...notDeleted },
      select: { id: true, year: true },
    });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const speaker = await prisma.speaker.findFirst({
      where: {
        slug: request.params.slug,
        ...notDeleted,
        editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
      },
      include: {
        // Nested filter again: a trashed talk must not ride along (#147), and
        // the year scopes the sessions to that edition (#351).
        talks: {
          where: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
          select: { slug: true, title: true, format: true, videoUrl: true },
          orderBy: { title: "asc" },
        },
      },
    });

    if (!speaker) return reply.status(404).send({ error: "Speaker not found" });

    return {
      slug: speaker.slug,
      name: speaker.name,
      photoUrl: speaker.photoUrl,
      company: speaker.company,
      city: speaker.city,
      bioFr: speaker.bioFr,
      bioEn: speaker.bioEn,
      socialLinks: parseSocialLinks(speaker.socialLinks),
      year: edition.year,
      talks: speaker.talks,
    };
  });

  // GET /api/editions/:year/talks — published talks of any edition by year,
  // with speakers, category and replay video (issue #63).
  app.get<{ Params: { year: string } }>("/editions/:year/talks", {
    schema: { params: { type: "object", required: ["year"], properties: { year: { type: "string" } } } },
  }, async (request, reply) => {
    const yearNum = Number(request.params.year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findFirst({ where: { year: yearNum, ...notDeleted }, select: { id: true } });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const talks = await prisma.talk.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
      orderBy: { title: "asc" },
      include: {
        // Nested: the filter does not reach here on its own, and a trashed
        // speaker would keep appearing under a live talk (#147).
        speakers: {
          // Since #351 the question is not "is this person published" but "is
          // this person published *for this edition*" — the status lives on the
          // participation, and the talk tells us which edition to look at.
          where: {
            ...notDeleted,
            editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
          },
          select: { slug: true, name: true, photoUrl: true },
          orderBy: { name: "asc" },
        },
        // `category` is to-one — Prisma takes no `where` there, so `deletedAt`
        // rides along and the serializer drops a trashed one (#147).
        category: { select: { nameFr: true, nameEn: true, color: true, deletedAt: true } },
      },
    });

    return talks.map((t) => ({
      slug: t.slug,
      title: t.title,
      description: t.description,
      format: t.format,
      level: t.level,
      language: t.language,
      videoUrl: t.videoUrl,
      category: visibleCategory(t.category),
      speakers: t.speakers,
    }));
  });

  // GET /api/editions/:year/talks/:slug — detail of one past talk (#343).
  //
  // `/api/talks/:slug` cannot serve this: it scopes to the featured edition, so
  // a 2019 talk answers 404. The year also disambiguates — Talk.slug is unique
  // per edition, not globally, so a title reused across years would collide.
  app.get<{ Params: { year: string; slug: string } }>("/editions/:year/talks/:slug", {
    schema: {
      params: {
        type: "object",
        required: ["year", "slug"],
        properties: { year: { type: "string" }, slug: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const yearNum = Number(request.params.year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findFirst({
      where: { year: yearNum, ...notDeleted },
      select: { id: true, year: true },
    });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const talk = await prisma.talk.findFirst({
      where: {
        editionId: edition.id,
        slug: request.params.slug,
        publicationStatus: "PUBLISHED",
        ...notDeleted,
      },
      include: {
        // Nested reads carry their own filter: a trashed speaker would keep
        // showing up under a live talk otherwise (#147).
        speakers: {
          // Published *for this edition* (#351), same reasoning as the list above.
          where: {
            ...notDeleted,
            editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
          },
          select: { slug: true, name: true, photoUrl: true, company: true },
          orderBy: { name: "asc" },
        },
        category: { select: { nameFr: true, nameEn: true, color: true, deletedAt: true } },
      },
    });

    if (!talk) return reply.status(404).send({ error: "Talk not found" });

    return {
      slug: talk.slug,
      title: talk.title,
      description: talk.description,
      format: talk.format,
      level: talk.level,
      language: talk.language,
      videoUrl: talk.videoUrl,
      year: edition.year,
      category: visibleCategory(talk.category),
      speakers: talk.speakers,
    };
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
      where: { year: { lt: edition.year }, ...notDeleted },
      orderBy: { year: "desc" },
      select: { year: true, aftermovieUrl: true, galleryUrl: true },
    });

    // Drive the Conférences / Speakers / Sponsors nav links (Header/Footer):
    // a link is shown only when the edition has at least one PUBLISHED record
    // of that kind — matching what the public pages actually display.
    // scheduledTalkCount additionally tells whether the schedule (planning) is
    // ready: at least one published talk has been given a time slot (startsAt),
    // which promotes the flat "Conférences" link to a "Programme" menu (#203).
    const [
      publishedTalkCount,
      scheduledTalkCount,
      publishedSpeakerCount,
      publishedSponsorCount,
      jobOfferCount,
    ] = await Promise.all([
        // These counts decide whether the nav links show at all, so the trash
        // has to be excluded: an edition whose talks are all trashed must not
        // keep advertising a "Conférences" menu that leads to an empty page.
        prisma.talk.count({
          where: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
        }),
        prisma.talk.count({
          where: {
            editionId: edition.id,
            publicationStatus: "PUBLISHED",
            startsAt: { not: null },
            ...notDeleted,
          },
        }),
        // Counted on the participations (#351): the identity is not what makes
        // a speaker part of this edition.
        prisma.speakerEdition.count({
          where: { editionId: edition.id, publicationStatus: "PUBLISHED", speaker: notDeleted },
        }),
        prisma.sponsor.count({
          where: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
        }),
        // Offers of published sponsors only — same set the recap page lists.
        // SponsorJobOffer itself is out of the trash's scope, but its sponsor is
        // not: offers of a trashed sponsor must stop counting.
        prisma.sponsorJobOffer.count({
          where: {
            sponsor: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
          },
        }),
      ]);

    return {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      status: edition.status,
      venueName: edition.venueName,
      venueAddress: edition.venueAddress,
      // Venue & practical-info page (#109). The map needs both coordinates, so
      // `hasVenueInfo` drives the nav entry on the presence of at least the map
      // or one written section — an edition with only a name/address stays as it
      // was and shows no dedicated page.
      venueLat: edition.venueLat,
      venueLng: edition.venueLng,
      venueTransports: edition.venueTransports,
      venueParking: edition.venueParking,
      venueDirectionsUrl: edition.venueDirectionsUrl,
      hasVenueInfo:
        (edition.venueLat !== null && edition.venueLng !== null) ||
        !!edition.venueTransports ||
        !!edition.venueParking,
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
      isProgramPublished: publishedTalkCount > 0,
      isScheduleReady: scheduledTalkCount > 0,
      hasSpeakers: publishedSpeakerCount > 0,
      hasSponsors: publishedSponsorCount > 0,
      // Drives the "Offres d'emploi" sub-entry: shown only while at least one
      // offer is published AND the post-event visibility window is still open.
      hasJobOffers: jobOfferCount > 0 && areOffersVisible(edition),
    };
  });

  // GET /api/editions/current/sponsor-tiers — visible sponsoring offers for the
  // featured edition (#318). Replaces the removed sponsor-plans route: reads the
  // catalogue through the per-edition binding, ordered by the edition's sortOrder,
  // with its price override.
  app.get("/editions/current/sponsor-tiers", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    const links = await prisma.editionSponsorTier.findMany({
      where: { editionId: edition.id, isVisible: true, tier: { ...notDeleted } },
      include: { tier: true },
      orderBy: { sortOrder: "asc" },
    });

    return links.map((l) => ({
      id: l.tier.id,
      nameFr: l.tier.nameFr,
      nameEn: l.tier.nameEn,
      subtitleFr: l.tier.subtitleFr,
      subtitleEn: l.tier.subtitleEn,
      descriptionFr: l.tier.descriptionFr,
      descriptionEn: l.tier.descriptionEn,
      standSize: l.tier.standSize,
      color: l.tier.color,
      logoScale: l.tier.logoScale,
      advantages: l.tier.advantages ? JSON.parse(l.tier.advantages) : [],
      // Per-edition price override (may be null).
      price: l.price,
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
        ...notDeleted,
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
      // Feeds Schema.org Offer.validFrom on the home page (#185).
      saleStartDate: tier.saleStartDate,
    }));
  });
}
