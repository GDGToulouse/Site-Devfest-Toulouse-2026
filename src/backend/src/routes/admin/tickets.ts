import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { computeTicketStatus } from "../editions.js";

interface TicketTierBody {
  nameFr: string;
  nameEn: string;
  price: number;
  isVisible?: boolean;
  saleStartDate?: string | null;
  saleEndDate?: string | null;
  externalUrl?: string;
  sortOrder?: number;
  editionId: number;
}

const BILLETWEB_API = "https://www.billetweb.fr/api";

function getBilletwebParams(): URLSearchParams | null {
  const user = process.env.BILLETWEB_USER;
  const key = process.env.BILLETWEB_KEY;
  if (!user || !key) return null;
  return new URLSearchParams({ user, key, version: "1" });
}

function unixToDate(ts: unknown): Date | null {
  if (!ts || ts === "") return null;
  const n = Number(ts);
  if (isNaN(n) || n === 0) return null;
  return new Date(n * 1000);
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default async function adminTicketRoutes(app: FastifyInstance) {
  // GET /api/admin/tickets/billetweb/events — list Billetweb events
  app.get("/tickets/billetweb/events", async (_request, reply) => {
    const params = getBilletwebParams();
    if (!params) {
      return reply.status(400).send({
        error: "Billetweb API credentials not configured (BILLETWEB_USER / BILLETWEB_KEY)",
      });
    }

    const res = await fetch(`${BILLETWEB_API}/events?${params}`);
    if (!res.ok) {
      const text = await res.text();
      return reply.status(502).send({ error: "Billetweb API error", detail: text });
    }

    const events = await res.json();

    return (events as Array<Record<string, unknown>>).map((e) => ({
      id: e.id,
      name: e.name,
      date: e.start,
      shop: e.shop,
    }));
  });

  // POST /api/admin/tickets/import/billetweb — import tiers from Billetweb
  app.post<{
    Body: { editionId: number; billetwebEventId: string };
  }>("/tickets/import/billetweb", async (request, reply) => {
    const { editionId, billetwebEventId } = request.body;

    if (!editionId || !billetwebEventId) {
      return reply.status(400).send({ error: "editionId and billetwebEventId are required" });
    }

    const params = getBilletwebParams();
    if (!params) {
      return reply.status(400).send({
        error: "Billetweb API credentials not configured",
      });
    }

    // Fetch event info for the shop URL
    const eventRes = await fetch(
      `${BILLETWEB_API}/events?${params}&id=${encodeURIComponent(billetwebEventId)}`,
    );
    if (!eventRes.ok) {
      return reply.status(502).send({ error: "Failed to fetch Billetweb event" });
    }
    const eventData = (await eventRes.json()) as Array<Record<string, unknown>>;
    const shopUrl = eventData[0]?.shop as string | undefined;

    // Fetch tickets
    const ticketsRes = await fetch(
      `${BILLETWEB_API}/event/${encodeURIComponent(billetwebEventId)}/tickets?${params}`,
    );
    if (!ticketsRes.ok) {
      const text = await ticketsRes.text();
      return reply.status(502).send({ error: "Billetweb tickets API error", detail: text });
    }

    const tickets = (await ticketsRes.json()) as Array<Record<string, unknown>>;

    // Delete existing tiers for this edition
    await prisma.ticketTier.deleteMany({ where: { editionId } });

    // Create new tiers from Billetweb data
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      const name = String(t.name || "");
      const price = Number(t.price) || 0;
      const visibility = Number(t.visibility);
      const isVisible = visibility === 0 || visibility === 1;

      await prisma.ticketTier.create({
        data: {
          nameFr: name,
          nameEn: name,
          price,
          isVisible,
          saleStartDate: unixToDate(t.start_time),
          saleEndDate: unixToDate(t.end_time),
          externalUrl: shopUrl || null,
          sortOrder: i,
          editionId,
        },
      });
    }

    return reply.status(201).send({ imported: tickets.length });
  });

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

    const now = new Date();

    return tiers.map((t) => ({
      id: t.id,
      nameFr: t.nameFr,
      nameEn: t.nameEn,
      price: Number(t.price),
      isVisible: t.isVisible,
      saleStartDate: t.saleStartDate,
      saleEndDate: t.saleEndDate,
      status: computeTicketStatus(t.saleStartDate, t.saleEndDate, now),
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
        isVisible: body.isVisible ?? true,
        saleStartDate: toDateOrNull(body.saleStartDate),
        saleEndDate: toDateOrNull(body.saleEndDate),
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
        isVisible: body.isVisible ?? existing.isVisible,
        saleStartDate: body.saleStartDate !== undefined ? toDateOrNull(body.saleStartDate) : existing.saleStartDate,
        saleEndDate: body.saleEndDate !== undefined ? toDateOrNull(body.saleEndDate) : existing.saleEndDate,
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
