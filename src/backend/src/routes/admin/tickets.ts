import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

interface TicketTierBody {
  nameFr: string;
  nameEn: string;
  price: number;
  status?: "AVAILABLE" | "SOLD_OUT" | "COMING_SOON";
  externalUrl?: string;
  sortOrder?: number;
  editionId: number;
}

export default async function adminTicketRoutes(app: FastifyInstance) {
  // GET /api/admin/tickets — list all ticket tiers
  app.get<{
    Querystring: { editionId?: string };
  }>("/tickets", async (request) => {
    const editionId = request.query.editionId ? Number(request.query.editionId) : undefined;
    const where = editionId ? { editionId } : {};

    const tiers = await prisma.ticketTier.findMany({
      where,
      orderBy: [{ editionId: "desc" }, { sortOrder: "asc" }],
      include: { edition: { select: { year: true } } },
    });

    return tiers.map((t) => ({
      id: t.id,
      nameFr: t.nameFr,
      nameEn: t.nameEn,
      price: Number(t.price),
      status: t.status,
      externalUrl: t.externalUrl,
      sortOrder: t.sortOrder,
      editionId: t.editionId,
      editionYear: t.edition.year,
    }));
  });

  // POST /api/admin/tickets — create ticket tier
  app.post<{ Body: TicketTierBody }>("/tickets", async (request, reply) => {
    const body = request.body;

    if (!body.nameFr?.trim() || !body.nameEn?.trim() || !body.editionId) {
      return reply.status(400).send({ error: "nameFr, nameEn, editionId are required" });
    }

    const tier = await prisma.ticketTier.create({
      data: {
        nameFr: body.nameFr.trim(),
        nameEn: body.nameEn.trim(),
        price: body.price || 0,
        status: body.status || "COMING_SOON",
        externalUrl: body.externalUrl?.trim() || null,
        sortOrder: body.sortOrder ?? 0,
        editionId: body.editionId,
      },
    });

    return reply.status(201).send({ id: tier.id });
  });

  // PUT /api/admin/tickets/:id — update ticket tier
  app.put<{
    Params: { id: string };
    Body: Partial<TicketTierBody>;
  }>("/tickets/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.ticketTier.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Ticket tier not found" });

    const body = request.body;

    const tier = await prisma.ticketTier.update({
      where: { id },
      data: {
        nameFr: body.nameFr?.trim() ?? existing.nameFr,
        nameEn: body.nameEn?.trim() ?? existing.nameEn,
        price: body.price ?? Number(existing.price),
        status: body.status ?? existing.status,
        externalUrl: body.externalUrl !== undefined ? (body.externalUrl?.trim() || null) : existing.externalUrl,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    });

    return { id: tier.id };
  });

  // DELETE /api/admin/tickets/:id
  app.delete<{
    Params: { id: string };
  }>("/tickets/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    await prisma.ticketTier.delete({ where: { id } });
    return { success: true };
  });
}
