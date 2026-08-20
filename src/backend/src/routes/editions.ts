import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { areOffersVisible } from "../lib/job-offers.js";
import { notDeleted, parseSocialLinks, visibleCategory } from "../lib/admin-helpers.js";
import { getEditionSponsorWall } from "../lib/sponsor-archive.js";

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
      include: { venue: true },
    });
    if (edition) return edition;
  }

  // 2. Fallback: latest edition by year
  return prisma.edition.findFirst({
    where: notDeleted,
    orderBy: { year: "desc" },
    include: { venue: true },
  });
}

export default async function editionRoutes(app: FastifyInstance) {
  // GET /api/editions — returns all editions (summary)
  app.get("/editions", async () => {
    const editions = await prisma.edition.findMany({
      where: notDeleted,
      orderBy: { year: "desc" },
      // `updatedAt` dates the edition page in the sitemap (#379).
      select: { id: true, year: true, status: true, archivedSiteUrl: true, startDate: true, updatedAt: true },
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
        // The venue moved to its own table (#105); the payload below keeps
        // rendering it flat so no consumer had to change.
        venue: true,
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
      venueName: edition.venue?.name ?? null,
      venueAddress: edition.venue?.address ?? null,
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

  // GET /api/editions/:year/sponsors — published sponsors of any edition by
  // year (#370). `/api/sponsors` cannot serve this: it scopes to the featured
  // edition, so a past year comes back empty.
  //
  // The payload matches /api/sponsors so the public wall and this grid share
  // their component and their type. Values are the ones frozen on the
  // participation (#375) — an archive shows what that year displayed, not what
  // the company logo and the tier catalogue happen to say today.
  app.get<{ Params: { year: string } }>("/editions/:year/sponsors", {
    schema: { params: { type: "object", required: ["year"], properties: { year: { type: "string" } } } },
  }, async (request, reply) => {
    const yearNum = Number(request.params.year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findFirst({ where: { year: yearNum, ...notDeleted }, select: { id: true } });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    return getEditionSponsorWall(edition.id);
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
      // Dates the talk page in the sitemap (#379). The list already carries
      // every published slug of the year, so no extra endpoint is needed.
      updatedAt: t.updatedAt,
      // Scheduling (#105). `room` is the label frozen when the talk was placed,
      // so an archive keeps the name that year's signage carried (#375).
      room: t.roomLabel,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      category: visibleCategory(t.category),
      speakers: t.speakers,
    }));
  });

  // GET /api/editions/:year/schedule — the grid of a year: scheduled talks and
  // everything around them (#105).
  //
  // Built for #106, which renders it. The columns are derived from the talks
  // actually scheduled rather than from the venue's room list: the 2026 venue
  // has eight rooms and the 2025 grid used five, so listing them all would draw
  // empty columns.
  app.get<{ Params: { year: string } }>("/editions/:year/schedule", {
    schema: { params: { type: "object", required: ["year"], properties: { year: { type: "string" } } } },
  }, async (request, reply) => {
    const yearNum = Number(request.params.year);
    if (isNaN(yearNum)) return reply.status(400).send({ error: "Invalid year" });

    const edition = await prisma.edition.findFirst({
      where: { year: yearNum, ...notDeleted },
      select: { id: true },
    });
    if (!edition) return reply.status(404).send({ error: "Edition not found" });

    const [talks, entries] = await Promise.all([
      prisma.talk.findMany({
        where: {
          editionId: edition.id,
          publicationStatus: "PUBLISHED",
          startsAt: { not: null },
          ...notDeleted,
        },
        orderBy: [{ startsAt: "asc" }, { title: "asc" }],
        include: {
          speakers: {
            where: {
              ...notDeleted,
              editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } },
            },
            select: { slug: true, name: true, photoUrl: true },
            orderBy: { name: "asc" },
          },
          category: { select: { nameFr: true, nameEn: true, color: true, deletedAt: true } },
          room: { select: { id: true, sortOrder: true } },
        },
      }),
      prisma.scheduleEntry.findMany({
        where: { editionId: edition.id },
        orderBy: { startsAt: "asc" },
        include: { room: { select: { id: true, name: true } } },
      }),
    ]);

    // One entry per room actually used, in grid order. A talk placed before its
    // room existed — or whose room was later deleted — keeps its frozen label
    // and lands in a column of its own rather than disappearing.
    const rooms = [
      ...new Map(
        talks.map((t) => [
          t.room?.id ?? `label:${t.roomLabel ?? ""}`,
          { id: t.room?.id ?? null, name: t.roomLabel ?? "", sortOrder: t.room?.sortOrder ?? 0 },
        ]),
      ).values(),
    ].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    return {
      year: yearNum,
      rooms,
      talks: talks.map((t) => ({
        slug: t.slug,
        title: t.title,
        format: t.format,
        level: t.level,
        language: t.language,
        room: t.roomLabel,
        roomId: t.roomId,
        startsAt: t.startsAt,
        endsAt: t.endsAt,
        category: visibleCategory(t.category),
        speakers: t.speakers,
      })),
      entries: entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        labelFr: e.labelFr,
        labelEn: e.labelEn,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        roomId: e.roomId,
        room: e.room?.name ?? null,
      })),
    };
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
        // Since #129 the tier is bought per edition, so the count moves onto the
        // participation join rather than the sponsor identity.
        prisma.sponsor.count({
          where: { ...notDeleted, editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED" } } },
        }),
        // Offers of published sponsors only — same set the recap page lists.
        // SponsorJobOffer now points at the participation (#129); the sponsor's
        // trash status still has to be checked explicitly since the join row
        // itself carries no deletedAt.
        prisma.sponsorJobOffer.count({
          where: {
            editionSponsor: { editionId: edition.id, publicationStatus: "PUBLISHED", sponsor: notDeleted },
          },
        }),
      ]);

    return {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      status: edition.status,
      // The venue lives in its own table since #105, but the payload stays
      // flat: nine frontend files read these keys, and reshaping the contract
      // to mirror the storage would have meant reworking pages that already
      // work — the homepage hero, /lieu, the past-edition sheets.
      venueName: edition.venue?.name ?? null,
      venueAddress: edition.venue?.address ?? null,
      // Venue & practical-info page (#109). The map needs both coordinates, so
      // `hasVenueInfo` drives the nav entry on the presence of at least the map
      // or one written section — an edition with only a name/address stays as it
      // was and shows no dedicated page.
      venueLat: edition.venue?.lat ?? null,
      venueLng: edition.venue?.lng ?? null,
      venueTransports: edition.venue?.transports ?? null,
      venueParking: edition.venue?.parking ?? null,
      venueDirectionsUrl: edition.venue?.directionsUrl ?? null,
      hasVenueInfo:
        (edition.venue?.lat != null && edition.venue?.lng != null) ||
        !!edition.venue?.transports ||
        !!edition.venue?.parking,
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
