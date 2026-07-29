import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";
import { areOffersVisible } from "../lib/job-offers.js";
import { notDeleted } from "../lib/admin-helpers.js";

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
  // GET /api/sponsors — published sponsors of the featured edition, ordered by
  // tier rank. The tier drives grouping, banner colour and logo size on the wall.
  app.get("/sponsors", async (_request, reply) => {
    const edition = await getFeaturedEdition();
    if (!edition) return reply.status(404).send({ error: "No edition found" });

    // Since #129 the tier is bought per edition, so the query moves onto the
    // participation join rather than the sponsor identity.
    const links = await prisma.editionSponsor.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED", sponsor: notDeleted },
      include: {
        sponsor: { select: { id: true, slug: true, name: true, logoUrl: true, websiteUrl: true } },
        tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
      },
    });

    return links
      .map((link) => ({
        id: link.sponsor.id,
        slug: link.sponsor.slug,
        name: link.sponsor.name,
        logoUrl: link.sponsor.logoUrl,
        tier: {
          key: link.tier.key,
          rank: link.tier.rank,
          nameFr: link.tier.nameFr,
          nameEn: link.tier.nameEn,
          logoScale: link.tier.logoScale,
          color: link.tier.color,
        },
        websiteUrl: link.sponsor.websiteUrl,
      }))
      // Higher rank = more prominent (RG-221), so sort descending.
      .sort((a, b) => (b.tier.rank - a.tier.rank) || a.name.localeCompare(b.name));
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
    // The company, by global slug (#129). No featured-edition scope: a company
    // page exists independently of whether it sponsors the current year.
    const sponsor = await prisma.sponsor.findFirst({
      where: {
        slug: request.params.slug,
        ...notDeleted,
        editions: { some: { publicationStatus: "PUBLISHED", edition: notDeleted } },
      },
      include: {
        // Nested reads need their own filter: a query extension would not reach
        // them (Prisma applies those to the top-level operation only).
        //
        // `edition: notDeleted` is required here since #352: the route used to
        // resolve getFeaturedEdition(), which already filtered the trash. Now
        // that it spans every year, a trashed edition would resurface.
        editions: {
          where: { publicationStatus: "PUBLISHED", edition: notDeleted },
          select: {
            editionId: true,
            edition: { select: { year: true } },
            tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
            jobOffers: {
              select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { edition: { year: "desc" } },
        },
        speakers: {
          where: { publicationStatus: "PUBLISHED", speaker: notDeleted },
          select: { speaker: { select: { slug: true, name: true, photoUrl: true, company: true } } },
          orderBy: { speaker: { name: "asc" } },
        },
      },
    });

    if (!sponsor) return reply.status(404).send({ error: "Sponsor not found" });

    // The featured edition is resolved separately and drives the highlight only.
    // Past years are tags: no tier, no offers (spec — "no past offer is ever
    // shown", so there is no edition to choose when filtering).
    const edition = await getFeaturedEdition();
    const current = edition ? sponsor.editions.find((e) => e.editionId === edition.id) : undefined;

    const tier = current
      ? {
          key: current.tier.key,
          rank: current.tier.rank,
          nameFr: current.tier.nameFr,
          nameEn: current.tier.nameEn,
          logoScale: current.tier.logoScale,
          color: current.tier.color,
        }
      : null;
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
        editions: { some: { editionId: edition.id, publicationStatus: "PUBLISHED", jobOffers: { some: {} } } },
      },
      select: {
        slug: true,
        name: true,
        logoUrl: true,
        editions: {
          where: { editionId: edition.id },
          select: {
            jobOffers: {
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
      logoUrl: s.logoUrl,
      jobOffers: s.editions.flatMap((e) => e.jobOffers),
    }));
  });
}
