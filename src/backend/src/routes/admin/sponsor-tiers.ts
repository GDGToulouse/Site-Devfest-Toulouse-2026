import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSponsors } from "../../lib/revalidate.js";
import { notDeleted, notFound, softDeleteData, parkUniqueValue } from "../../lib/admin-helpers.js";

// CRUD for the global sponsoring-tier catalogue (#318). A tier is shared across
// editions; its per-edition binding (price, visibility, order) lives in
// EditionSponsorTier and is managed under /admin/editions/:id/sponsor-tiers.

interface SponsorTierCreateBody {
  key: string;
  nameFr: string;
  nameEn: string;
  subtitleFr?: string;
  subtitleEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  advantages?: { fr: string; en: string }[];
  standSize?: string;
  color?: string;
  logoScale?: number;
  rank?: number;
  jobOfferQuota?: number;
  allowsPromoIdeas?: boolean;
}

type SponsorTierUpdateBody = Partial<SponsorTierCreateBody>;

interface SponsorTierIdParams {
  id: string;
}

function serialize(t: { advantages: string | null; [k: string]: unknown }) {
  return { ...t, advantages: t.advantages ? JSON.parse(t.advantages) : [] };
}

export default async function adminSponsorTierRoutes(app: FastifyInstance) {
  // GET /api/admin/sponsor-tiers — the whole catalogue, most important first.
  app.get("/sponsor-tiers", async () => {
    const tiers = await prisma.sponsorTier.findMany({
      where: notDeleted,
      orderBy: { rank: "desc" },
    });
    return tiers.map(serialize);
  });

  // GET /api/admin/sponsor-tiers/:id
  app.get<{ Params: SponsorTierIdParams }>("/sponsor-tiers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const tier = await prisma.sponsorTier.findFirst({
      where: { id: Number(request.params.id), ...notDeleted },
    });
    if (!tier) return notFound(reply, "Sponsor tier");
    return serialize(tier);
  });

  // POST /api/admin/sponsor-tiers
  app.post<{ Body: SponsorTierCreateBody }>("/sponsor-tiers", async (request, reply) => {
    const body = request.body;

    if (!body.key?.trim() || !body.nameFr?.trim() || !body.nameEn?.trim()) {
      return reply.code(400).send({ error: "key, nameFr and nameEn are required" });
    }
    // `key` is @unique across the whole table, trash included — a parked key
    // still owns its slot. Check without the notDeleted filter.
    const clash = await prisma.sponsorTier.findFirst({ where: { key: body.key.trim() }, select: { id: true } });
    if (clash) return reply.code(409).send({ error: "key already used" });

    const tier = await prisma.sponsorTier.create({
      data: {
        key: body.key.trim(),
        nameFr: body.nameFr.trim(),
        nameEn: body.nameEn.trim(),
        subtitleFr: body.subtitleFr || null,
        subtitleEn: body.subtitleEn || null,
        descriptionFr: body.descriptionFr || null,
        descriptionEn: body.descriptionEn || null,
        advantages: body.advantages ? JSON.stringify(body.advantages) : null,
        standSize: body.standSize || null,
        ...(body.color !== undefined && { color: body.color }),
        ...(body.logoScale !== undefined && { logoScale: body.logoScale }),
        ...(body.rank !== undefined && { rank: body.rank }),
        ...(body.jobOfferQuota !== undefined && { jobOfferQuota: body.jobOfferQuota }),
        ...(body.allowsPromoIdeas !== undefined && { allowsPromoIdeas: body.allowsPromoIdeas }),
      },
    });

    revalidateSponsors();
    return reply.code(201).send(serialize(tier));
  });

  // PUT /api/admin/sponsor-tiers/:id
  app.put<{ Params: SponsorTierIdParams; Body: SponsorTierUpdateBody }>("/sponsor-tiers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const body = request.body;

    const existing = await prisma.sponsorTier.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Sponsor tier");

    if (body.key !== undefined && body.key.trim() !== existing.key) {
      const clash = await prisma.sponsorTier.findFirst({ where: { key: body.key.trim() }, select: { id: true } });
      if (clash) return reply.code(409).send({ error: "key already used" });
    }

    const tier = await prisma.sponsorTier.update({
      where: { id },
      data: {
        ...(body.key !== undefined && { key: body.key.trim() }),
        ...(body.nameFr !== undefined && { nameFr: body.nameFr.trim() }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn.trim() }),
        ...(body.subtitleFr !== undefined && { subtitleFr: body.subtitleFr || null }),
        ...(body.subtitleEn !== undefined && { subtitleEn: body.subtitleEn || null }),
        ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr || null }),
        ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn || null }),
        ...(body.advantages !== undefined && { advantages: body.advantages ? JSON.stringify(body.advantages) : null }),
        ...(body.standSize !== undefined && { standSize: body.standSize || null }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.logoScale !== undefined && { logoScale: body.logoScale }),
        ...(body.rank !== undefined && { rank: body.rank }),
        ...(body.jobOfferQuota !== undefined && { jobOfferQuota: body.jobOfferQuota }),
        ...(body.allowsPromoIdeas !== undefined && { allowsPromoIdeas: body.allowsPromoIdeas }),
      },
    });

    revalidateSponsors();
    return serialize(tier);
  });

  // DELETE /api/admin/sponsor-tiers/:id — moves the tier to the trash (#147).
  // Refused while any live sponsor or edition binding still points at it, so a
  // sponsor can never end up attached to a trashed tier.
  app.delete<{ Params: SponsorTierIdParams }>("/sponsor-tiers/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.sponsorTier.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Sponsor tier");

    // The tier is bought per edition since #129, so "in use" is asked of the
    // participation, not the sponsor identity.
    const [sponsorCount, linkCount] = await Promise.all([
      prisma.editionSponsor.count({ where: { tierId: id, sponsor: notDeleted } }),
      prisma.editionSponsorTier.count({ where: { tierId: id } }),
    ]);
    if (sponsorCount > 0 || linkCount > 0) {
      return reply.code(409).send({
        error: "Tier still in use",
        sponsors: sponsorCount,
        editions: linkCount,
      });
    }

    // `key` is @unique — park it so a new tier can reuse the readable value.
    await prisma.sponsorTier.update({
      where: { id },
      data: { ...softDeleteData(), key: parkUniqueValue(existing.key, id) },
    });

    revalidateSponsors();
    return reply.code(204).send();
  });
}
