import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { notDeleted, softDeleteData } from "../../lib/admin-helpers.js";
import { revalidateJobOffers, revalidateSponsors } from "../../lib/revalidate.js";
import {
  jobOfferBodyError,
  jobOfferBodySchema,
  jobOfferData,
  jobOfferPatchSchema,
  newJobOfferData,
  type JobOfferBody,
} from "../../lib/job-offers.js";

// Sponsors' job offers in the back-office (#609). Until then the team could only
// count them in the sponsors list: creating, fixing or withdrawing one meant
// asking the sponsor, or opening their partner space by hand.
//
// Two differences with the sponsor space, both deliberate:
// - the tier quota does not bind the team. It is a commercial rule the
//   organisers may bend; the screen shows it and warns past it;
// - the participation is chosen explicitly (sponsor + edition) rather than read
//   from the featured edition, so an earlier year can be corrected too.

const JOB_OFFER_PAGE_SIZE = 25;
const JOB_OFFER_PAGE_SIZE_MAX = 100;
const JOB_OFFER_SORTS = ["title", "sponsor", "createdAt", "updatedAt"] as const;

interface JobOfferListQuery {
  editionId?: string;
  sponsorId?: string;
  search?: string;
  page?: string;
  limit?: string;
  sort?: (typeof JOB_OFFER_SORTS)[number];
  order?: "asc" | "desc";
}

const OFFER_SELECT = {
  id: true,
  title: true,
  descriptionFr: true,
  descriptionEn: true,
  url: true,
  createdAt: true,
  updatedAt: true,
} as const;

const idParam = { type: "string", pattern: "^[0-9]+$" } as const;

// An offer is the team's to edit while its company, its participation and its
// edition are all alive: a trashed sponsor takes its offers off the site with it.
const liveOffer = {
  ...notDeleted,
  editionSponsor: { sponsor: notDeleted, edition: notDeleted },
} satisfies Prisma.SponsorJobOfferWhereInput;

function orderFor(sort: JobOfferListQuery["sort"], order: "asc" | "desc"): Prisma.SponsorJobOfferOrderByWithRelationInput[] {
  switch (sort) {
    case "title":
      return [{ title: order }, { id: "asc" }];
    case "sponsor":
      return [{ editionSponsor: { sponsor: { name: order } } }, { title: "asc" }];
    case "updatedAt":
      return [{ updatedAt: order }, { id: "asc" }];
    default:
      return [{ createdAt: order }, { id: "asc" }];
  }
}

export default async function adminJobOfferRoutes(app: FastifyInstance) {
  // GET /api/admin/job-offers — every offer, across sponsors (#609). Same
  // contract as the speakers and sponsors lists (#572, #574): with `page`, a
  // page and its total; without, the full array.
  app.get<{ Querystring: JobOfferListQuery }>("/job-offers", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          editionId: idParam,
          sponsorId: idParam,
          search: { type: "string", maxLength: 200 },
          page: idParam,
          limit: idParam,
          sort: { type: "string", enum: [...JOB_OFFER_SORTS] },
          order: { type: "string", enum: ["asc", "desc"] },
        },
      },
    },
  }, async (request) => {
    const q = request.query;
    const search = q.search?.trim();
    const where: Prisma.SponsorJobOfferWhereInput = {
      ...liveOffer,
      editionSponsor: {
        ...liveOffer.editionSponsor,
        ...(q.editionId && { editionId: Number(q.editionId) }),
        ...(q.sponsorId && { sponsorId: Number(q.sponsorId) }),
      },
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { editionSponsor: { sponsor: { name: { contains: search, mode: "insensitive" } } } },
        ],
      }),
    };
    const select = {
      ...OFFER_SELECT,
      editionSponsor: {
        select: {
          editionId: true,
          edition: { select: { year: true } },
          sponsor: { select: { id: true, name: true } },
          tier: { select: { nameFr: true } },
        },
      },
    } as const;
    const orderBy = orderFor(q.sort, q.order ?? (q.sort === "title" || q.sort === "sponsor" ? "asc" : "desc"));

    const toRow = (o: Prisma.SponsorJobOfferGetPayload<{ select: typeof select }>) => ({
      id: o.id,
      title: o.title,
      url: o.url,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      sponsor: o.editionSponsor.sponsor,
      editionId: o.editionSponsor.editionId,
      year: o.editionSponsor.edition.year,
      tierName: o.editionSponsor.tier.nameFr,
    });

    if (!q.page) {
      const offers = await prisma.sponsorJobOffer.findMany({ where, select, orderBy });
      return offers.map(toRow);
    }
    const page = Math.max(1, Number(q.page));
    const limit = Math.min(JOB_OFFER_PAGE_SIZE_MAX, Math.max(1, Number(q.limit) || JOB_OFFER_PAGE_SIZE));
    const [total, offers] = await Promise.all([
      prisma.sponsorJobOffer.count({ where }),
      prisma.sponsorJobOffer.findMany({ where, select, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);
    return { page, limit, total, items: offers.map(toRow) };
  });

  // GET /api/admin/sponsors/:id/editions/:editionId/job-offers — one
  // participation's offers and its tier quota, for the sponsor sheet.
  app.get<{ Params: { id: string; editionId: string } }>("/sponsors/:id/editions/:editionId/job-offers", {
    schema: { params: { type: "object", required: ["id", "editionId"], properties: { id: idParam, editionId: idParam } } },
  }, async (request, reply) => {
    const participation = await findParticipation(Number(request.params.id), Number(request.params.editionId));
    if (!participation) return reply.code(404).send({ error: "participation_not_found" });
    return {
      quota: participation.tier.jobOfferQuota,
      offers: await prisma.sponsorJobOffer.findMany({
        where: { editionSponsorId: participation.id, ...notDeleted },
        select: OFFER_SELECT,
        orderBy: { createdAt: "asc" },
      }),
    };
  });

  // POST /api/admin/sponsors/:id/editions/:editionId/job-offers — create one.
  // No quota check: see the header.
  app.post<{ Params: { id: string; editionId: string }; Body: JobOfferBody }>("/sponsors/:id/editions/:editionId/job-offers", {
    schema: {
      params: { type: "object", required: ["id", "editionId"], properties: { id: idParam, editionId: idParam } },
      body: jobOfferBodySchema,
    },
  }, async (request, reply) => {
    const participation = await findParticipation(Number(request.params.id), Number(request.params.editionId));
    if (!participation) return reply.code(404).send({ error: "participation_not_found" });

    const invalid = jobOfferBodyError(request.body);
    if (invalid) return reply.code(400).send(invalid);

    const offer = await prisma.sponsorJobOffer.create({
      data: { editionSponsorId: participation.id, ...newJobOfferData(request.body) },
      select: OFFER_SELECT,
    });
    revalidateSponsors();
    revalidateJobOffers();
    return reply.code(201).send(offer);
  });

  // PUT /api/admin/job-offers/:id
  app.put<{ Params: { id: string }; Body: Partial<JobOfferBody> }>("/job-offers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: idParam } }, body: jobOfferPatchSchema },
  }, async (request, reply) => {
    const existing = await prisma.sponsorJobOffer.findFirst({
      where: { id: Number(request.params.id), ...liveOffer },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "offer_not_found" });

    const body = request.body ?? {};
    const invalid = jobOfferBodyError(body);
    if (invalid) return reply.code(400).send(invalid);

    const offer = await prisma.sponsorJobOffer.update({
      where: { id: existing.id },
      data: jobOfferData(body),
      select: OFFER_SELECT,
    });
    revalidateSponsors();
    revalidateJobOffers();
    return offer;
  });

  // DELETE /api/admin/job-offers/:id — to the trash, restorable for 30 days.
  // Replaces DELETE /sponsors/:id/job-offers/:offerId (#251), which deleted for
  // good and which no screen ever called.
  app.delete<{ Params: { id: string } }>("/job-offers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: idParam } } },
  }, async (request, reply) => {
    const existing = await prisma.sponsorJobOffer.findFirst({
      where: { id: Number(request.params.id), ...liveOffer },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "offer_not_found" });

    await prisma.sponsorJobOffer.update({ where: { id: existing.id }, data: softDeleteData() });
    revalidateSponsors();
    revalidateJobOffers();
    return reply.code(204).send();
  });
}

async function findParticipation(sponsorId: number, editionId: number) {
  return prisma.editionSponsor.findFirst({
    where: { sponsorId, editionId, sponsor: notDeleted, edition: notDeleted },
    select: { id: true, tier: { select: { jobOfferQuota: true } } },
  });
}
