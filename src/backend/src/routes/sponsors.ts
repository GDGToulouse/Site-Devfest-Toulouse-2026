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

    const sponsors = await prisma.sponsor.findMany({
      where: { editionId: edition.id, publicationStatus: "PUBLISHED", ...notDeleted },
      include: { tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } } },
    });

    return sponsors
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        logoUrl: s.logoUrl,
        tier: {
          key: s.tier.key,
          rank: s.tier.rank,
          nameFr: s.tier.nameFr,
          nameEn: s.tier.nameEn,
          logoScale: s.tier.logoScale,
          color: s.tier.color,
        },
        websiteUrl: s.websiteUrl,
      }))
      // Higher rank = more prominent (RG-221), so sort descending.
      .sort((a, b) => (b.tier.rank - a.tier.rank) || a.name.localeCompare(b.name));
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
      where: {
        editionId: edition.id,
        slug: request.params.slug,
        publicationStatus: "PUBLISHED",
        ...notDeleted,
      },
      include: {
        tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
        // Nested reads need their own filter: a query extension would not reach
        // them (Prisma applies those to the top-level operation only), and a
        // trashed speaker would otherwise still show up on a live sponsor page.
        // Participations since #353, so the association is already dated: no
        // need to re-scope on the edition, the join row *is* the year. Still
        // filtered on the publication of that participation and on the person
        // not being in the trash.
        speakers: {
          where: { publicationStatus: "PUBLISHED", speaker: notDeleted },
          select: {
            speaker: { select: { slug: true, name: true, photoUrl: true, company: true } },
          },
          orderBy: { speaker: { name: "asc" } },
        },
        jobOffers: {
          select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!sponsor) return reply.status(404).send({ error: "Sponsor not found" });

    // Offers disappear one month after the event (#251).
    const jobOffers = areOffersVisible(edition) ? sponsor.jobOffers : [];

    return {
      id: sponsor.id,
      slug: sponsor.slug,
      name: sponsor.name,
      logoUrl: sponsor.logoUrl,
      tier: {
        key: sponsor.tier.key,
        rank: sponsor.tier.rank,
        nameFr: sponsor.tier.nameFr,
        nameEn: sponsor.tier.nameEn,
        logoScale: sponsor.tier.logoScale,
        color: sponsor.tier.color,
      },
      websiteUrl: sponsor.websiteUrl,
      descriptionFr: sponsor.descriptionFr,
      descriptionEn: sponsor.descriptionEn,
      socialLinks: parseSocial(sponsor.socialLinks),
      // Projected back to the pre-#353 shape: the payload must not change.
      speakers: sponsor.speakers.map((link) => link.speaker),
      jobOffers,
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
        editionId: edition.id,
        publicationStatus: "PUBLISHED",
        ...notDeleted,
        jobOffers: { some: {} },
      },
      select: {
        slug: true,
        name: true,
        logoUrl: true,
        jobOffers: {
          select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return sponsors;
  });
}
