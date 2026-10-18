import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { areOffersVisible } from "../lib/job-offers.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { archivedLogoUrl, archivedTier, getEditionSponsorWall } from "../lib/sponsor-archive.js";
import { mostRecent } from "../lib/lastmod.js";

function parseSocial(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// The company's page, shared by the public route and the team's draft preview
// (#618): `includeDrafts` lifts the publication filters, never the trash ones.
export async function findSponsorPage(slug: string, { includeDrafts = false } = {}) {
  const published = includeDrafts ? {} : ({ publicationStatus: "PUBLISHED" } as const);
  // The company, by global slug (#129). No featured-edition scope: a company
  // page exists independently of whether it sponsors the current year.
  const sponsor = await prisma.sponsor.findFirst({
    where: {
      slug,
      ...notDeleted,
      editions: { some: { ...published, edition: notDeleted } },
    },
    include: {
      // Nested reads need their own filter: a query extension would not reach
      // them (Prisma applies those to the top-level operation only).
      //
      // `edition: notDeleted` is required here since #352: the route used to
      // resolve getFeaturedEdition(), which already filtered the trash. Now
      // that it spans every year, a trashed edition would resurface.
      editions: {
        where: { ...published, edition: notDeleted },
        select: {
          editionId: true,
          edition: { select: { year: true } },
          tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
          // What this edition displayed (#375), preferred over the live values.
          logoUrl: true,
          tierNameFr: true,
          tierNameEn: true,
          tierColor: true,
          tierLogoScale: true,
          jobOffers: {
            where: notDeleted,
            select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { edition: { year: "desc" } },
      },
      speakers: {
        where: { ...published, speaker: notDeleted },
        select: { speaker: { select: { slug: true, name: true, photoUrl: true, company: true } } },
        orderBy: { speaker: { name: "asc" } },
      },
    },
  });

  if (!sponsor) return null;

  // The featured edition is resolved separately and drives the highlight only.
  // Past years are tags: no tier, no offers (spec — "no past offer is ever
  // shown", so there is no edition to choose when filtering).
  const edition = await getFeaturedEdition();
  const current = edition ? sponsor.editions.find((e) => e.editionId === edition.id) : undefined;

  // As the featured edition displayed it (#375), not as the catalogue reads
  // today. The logo below stays the identity's: this is the company's page,
  // so it shows the company as it is now — the archive lives on the wall.
  const tier = current ? archivedTier(current) : null;
  // Offers disappear one month after the event (#251).
  const jobOffers = current && edition && areOffersVisible(edition) ? current.jobOffers : [];

  return {
    id: sponsor.id,
    slug: sponsor.slug,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl,
    tier,
    websiteUrl: sponsor.websiteUrl,
    descriptionFr: sponsor.descriptionFr,
    descriptionEn: sponsor.descriptionEn,
    socialLinks: parseSocial(sponsor.socialLinks),
    // Projected back to the pre-#353 shape: the payload must not change.
    speakers: sponsor.speakers.map((link) => link.speaker),
    jobOffers,
    // Year tags (#129), newest first. The frontend links them to /editions/<year>.
    editions: sponsor.editions.map((e) => e.edition.year),
  };
}

export default async function sponsorRoutes(app: FastifyInstance) {
  // GET /api/sponsors — published sponsors of the featured edition, ordered by
  // tier rank. The tier drives grouping, banner colour and logo size on the wall.
  app.get("/sponsors", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    // Shared with /api/editions/:year/sponsors (#370): same wall, same frozen
    // values (#375), only the edition resolved differs.
    return getEditionSponsorWall(edition.id);
  });

  // GET /api/sponsors/indexable — every company that has a page, all editions.
  //
  // /api/sponsors above is the featured edition's wall, so it cannot drive the
  // sitemap (#379): a company that sponsored 2025 but not 2026 is absent from
  // the wall while /sponsors/:slug still answers 200 for it. Reading the same
  // condition as that route — at least one published participation on a live
  // edition — is what keeps the sitemap and the pages in agreement.
  //
  // Declared before "/sponsors/:slug" for readability only: find-my-way gives
  // static segments priority over parametric ones, so the order does not matter
  // — but it does mean "indexable" can never be a company's slug.
  app.get("/sponsors/indexable", async () => {
    const sponsors = await prisma.sponsor.findMany({
      where: {
        ...notDeleted,
        editions: { some: { publicationStatus: "PUBLISHED", edition: notDeleted } },
      },
      orderBy: { name: "asc" },
      select: {
        slug: true,
        updatedAt: true,
        // The most recent published participation dates the page as well: its
        // logo and tier are part of what the page renders (#375).
        editions: {
          where: { publicationStatus: "PUBLISHED", edition: notDeleted },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
      },
    });

    return sponsors.map((s) => ({
      slug: s.slug,
      updatedAt: mostRecent(s.updatedAt, s.editions[0]?.updatedAt),
    }));
  });

  // GET /api/sponsors/hall-of-fame — every company that ever sponsored, with the
  // years it did (#611). The sponsors' counterpart of /api/speakers/hall-of-fame.
  //
  // Static, so find-my-way serves it before "/sponsors/:slug": "hall-of-fame"
  // can never be a company's slug, like "indexable" above.
  app.get("/sponsors/hall-of-fame", async () => {
    // Read through the participations, one row per (company, year), folded in
    // memory: the same shape of query as the speakers' hall of fame. Published
    // and out of the trash on both sides — a draft year must not surface here.
    const links = await prisma.editionSponsor.findMany({
      where: { publicationStatus: "PUBLISHED", sponsor: notDeleted, edition: notDeleted },
      orderBy: [{ sponsor: { name: "asc" } }, { edition: { year: "desc" } }],
      // A guard, not a real limit: ~180 participations today, ~30 more a year.
      take: 3000,
      select: {
        logoUrl: true,
        tierNameFr: true,
        tierNameEn: true,
        tierColor: true,
        tierLogoScale: true,
        tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
        edition: { select: { year: true } },
        sponsor: { select: { slug: true, name: true, logoUrl: true } },
      },
    });

    type Participation = { year: number; logoUrl: string | null; tier: ReturnType<typeof archivedTier> };
    const companies = new Map<string, { slug: string; name: string; logoUrl: string | null; participations: Participation[] }>();
    for (const link of links) {
      // As that year displayed it (#375): the page shows it under a year filter.
      const participation = {
        year: link.edition.year,
        logoUrl: archivedLogoUrl(link, link.sponsor),
        tier: archivedTier(link),
      };
      const entry = companies.get(link.sponsor.slug);
      if (entry) entry.participations.push(participation);
      else companies.set(link.sponsor.slug, { ...link.sponsor, participations: [participation] });
    }
    return [...companies.values()];
  });

  // GET /api/sponsors/:slug — detail of a published sponsor + its speakers (RG-226).
  // Since #129 the company page exists independently of the featured edition:
  // any sponsor with at least one published participation resolves, and the
  // featured edition only drives the highlight (tier + live job offers).
  app.get<{ Params: { slug: string } }>("/sponsors/:slug", {
    schema: {
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
    },
  }, async (request, reply) => {
    const page = await findSponsorPage(request.params.slug);
    if (!page) return reply.status(404).send({ error: "Sponsor not found" });
    return page;
  });

  // GET /api/job-offers — all partner job offers for the featured edition,
  // grouped by sponsor, for the recap page (#251). Hidden once the offers'
  // visibility window has passed.
  app.get("/job-offers", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });
    if (!areOffersVisible(edition)) return [];

    const sponsors = await prisma.sponsor.findMany({
      where: {
        ...notDeleted,
        editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED", jobOffers: { some: notDeleted } } },
      },
      select: {
        slug: true,
        name: true,
        logoUrl: true,
        editions: {
          where: { editionId: edition.id },
          select: {
            logoUrl: true,
            jobOffers: {
              where: notDeleted,
              select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Flatten so the emitted shape stays a flat jobOffers array per sponsor,
    // unchanged despite the query now going through the participation join.
    return sponsors.map((s) => ({
      slug: s.slug,
      name: s.name,
      // The where above pins editions to the featured one, so at most one row.
      logoUrl: s.editions[0] ? archivedLogoUrl(s.editions[0], s) : s.logoUrl,
      jobOffers: s.editions.flatMap((e) => e.jobOffers),
    }));
  });
}
