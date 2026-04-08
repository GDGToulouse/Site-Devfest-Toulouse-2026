import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateHome } from "../../lib/revalidate.js";

export default async function adminSponsorPlanRoutes(app: FastifyInstance) {
  // GET /api/admin/sponsor-plans?editionId=X
  app.get("/sponsor-plans", async (request, reply) => {
    const { editionId } = request.query as { editionId?: string };
    if (!editionId) return reply.code(400).send({ error: "editionId required" });

    const plans = await prisma.sponsorPlan.findMany({
      where: { editionId: Number(editionId) },
      orderBy: { sortOrder: "asc" },
    });

    return plans.map((p) => ({
      ...p,
      advantages: p.advantages ? JSON.parse(p.advantages) : [],
    }));
  });

  // POST /api/admin/sponsor-plans
  app.post("/sponsor-plans", async (request, reply) => {
    const body = request.body as {
      editionId: number;
      nameFr: string;
      nameEn: string;
      subtitleFr?: string;
      subtitleEn?: string;
      descriptionFr?: string;
      descriptionEn?: string;
      price?: string;
      standSize?: string;
      advantages?: { fr: string; en: string }[];
      color?: string;
      isVisible?: boolean;
      sortOrder?: number;
    };

    if (!body.editionId || !body.nameFr || !body.nameEn) {
      return reply.code(400).send({ error: "editionId, nameFr and nameEn are required" });
    }

    const plan = await prisma.sponsorPlan.create({
      data: {
        editionId: body.editionId,
        nameFr: body.nameFr,
        nameEn: body.nameEn,
        subtitleFr: body.subtitleFr || null,
        subtitleEn: body.subtitleEn || null,
        descriptionFr: body.descriptionFr || null,
        descriptionEn: body.descriptionEn || null,
        price: body.price || null,
        standSize: body.standSize || null,
        advantages: body.advantages ? JSON.stringify(body.advantages) : null,
        color: body.color || "#109E6E",
        isVisible: body.isVisible ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    revalidateHome();
    return reply.code(201).send(plan);
  });

  // PUT /api/admin/sponsor-plans/:id
  app.put("/sponsor-plans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      nameFr?: string;
      nameEn?: string;
      subtitleFr?: string;
      subtitleEn?: string;
      descriptionFr?: string;
      descriptionEn?: string;
      price?: string;
      standSize?: string;
      advantages?: { fr: string; en: string }[];
      color?: string;
      isVisible?: boolean;
      sortOrder?: number;
    };

    const plan = await prisma.sponsorPlan.update({
      where: { id: Number(id) },
      data: {
        ...(body.nameFr !== undefined && { nameFr: body.nameFr }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
        ...(body.subtitleFr !== undefined && { subtitleFr: body.subtitleFr || null }),
        ...(body.subtitleEn !== undefined && { subtitleEn: body.subtitleEn || null }),
        ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr || null }),
        ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn || null }),
        ...(body.price !== undefined && { price: body.price || null }),
        ...(body.standSize !== undefined && { standSize: body.standSize || null }),
        ...(body.advantages !== undefined && { advantages: JSON.stringify(body.advantages) }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.isVisible !== undefined && { isVisible: body.isVisible }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });

    revalidateHome();
    return plan;
  });

  // DELETE /api/admin/sponsor-plans/:id
  app.delete("/sponsor-plans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.sponsorPlan.delete({ where: { id: Number(id) } });
    revalidateHome();
    return reply.code(204).send();
  });
}
