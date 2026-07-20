import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { computeTicketStatus } from "../editions.js";
import { revalidateBilletterie } from "../../lib/revalidate.js";
import { notDeleted, notFound, softDeleteData } from "../../lib/admin-helpers.js";

type TicketStatus = "AVAILABLE" | "SOLD_OUT" | "COMING_SOON";
const TICKET_STATUSES: TicketStatus[] = ["AVAILABLE", "SOLD_OUT", "COMING_SOON"];

interface TicketTierBody {
  nameFr: string;
  nameEn: string;
  price: number;
  isVisible?: boolean;
  saleStartDate?: string | null;
  saleEndDate?: string | null;
  externalUrl?: string;
  sortOrder?: number;
  // Admin status override. "AUTO" (or null) clears it → falls back to
  // the BilletWeb sync / date-based computation.
  manualStatus?: TicketStatus | "AUTO" | null;
  editionId: number;
}

const BILLETWEB_API = "https://www.billetweb.fr/api";

// Maps BilletWeb's /event/:id/avail "avail" field to a sold-out flag.
// "-1" (or a negative number) means unlimited → not sold out. A remaining
// quantity of 0 or less means sold out. Anything unparseable → unknown (null).
export function availToIsSoldOut(avail: unknown): boolean | null {
  if (avail === undefined || avail === null || avail === "") return null;
  const n = Number(avail);
  if (isNaN(n)) return null;
  if (n < 0) return false;
  return n <= 0;
}

// Fetches per-ticket sold-out flags from /event/:id/avail, keyed by ticket id.
// Returns an empty map on any failure — the import must not break if BilletWeb's
// availability endpoint is unavailable.
async function fetchBilletwebSoldOut(
  billetwebEventId: string,
  params: URLSearchParams,
): Promise<Map<string, boolean | null>> {
  const map = new Map<string, boolean | null>();
  try {
    const res = await fetch(
      `${BILLETWEB_API}/event/${encodeURIComponent(billetwebEventId)}/avail?${params}`,
    );
    if (!res.ok) return map;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    for (const row of rows) {
      if (row.type !== "ticket") continue;
      const id = String(row.id ?? "");
      if (!id) continue;
      map.set(id, availToIsSoldOut(row.avail));
    }
  } catch {
    // Availability is best-effort; leave the map empty on network errors.
  }
  return map;
}

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

    // Fetch per-ticket availability (sold-out) to seed isSoldOut (best-effort).
    const soldOutByTicket = await fetchBilletwebSoldOut(billetwebEventId, params);

    // Replace the edition's tiers wholesale. This stays a HARD delete on
    // purpose, unlike the single-tier DELETE below (#147): the loop right after
    // re-creates tiers at sortOrder 0..n-1, and a soft-deleted row keeps its
    // sortOrder slot — `@@unique([editionId, sortOrder])` would reject the
    // re-import. sortOrder is an Int, so it cannot be parked out of the way the
    // way a slug can. Tiers replaced by a re-import are mirror images of what
    // BilletWeb just returned, so there is nothing worth keeping in the trash.
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
          isSoldOut: soldOutByTicket.get(String(t.id ?? "")) ?? null,
          sortOrder: i,
          editionId,
        },
      });
    }

    revalidateBilletterie();
    return reply.status(201).send({ imported: tickets.length });
  });

  // GET /api/admin/tickets — list all ticket tiers
  app.get<{
    Querystring: { editionId?: string };
  }>("/tickets", async (request) => {
    const editionId = request.query.editionId ? Number(request.query.editionId) : undefined;
    const where = editionId ? { editionId, ...notDeleted } : { ...notDeleted };

    const tiers = await prisma.ticketTier.findMany({
      where,
      orderBy: [{ editionId: "desc" }, { sortOrder: "asc" }],
      include: { edition: { select: { year: true } } },
    });

    const now = new Date();

    return tiers.map((t: (typeof tiers)[number]) => ({
      id: t.id,
      nameFr: t.nameFr,
      nameEn: t.nameEn,
      price: Number(t.price),
      isVisible: t.isVisible,
      saleStartDate: t.saleStartDate,
      saleEndDate: t.saleEndDate,
      status: computeTicketStatus(t, now),
      manualStatus: t.manualStatus,
      isSoldOut: t.isSoldOut,
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

    // When no sortOrder is supplied, append the tier after the edition's last
    // one. Defaulting to 0 collides with the (editionId, sortOrder) unique
    // constraint as soon as the edition already has a tier at 0.
    let sortOrder = body.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      // Deliberately NOT filtered on deletedAt: `@@unique([editionId, sortOrder])`
      // is a database-wide constraint and a trashed tier keeps its slot until
      // purged (sortOrder is an Int, so it cannot be parked). Skipping trashed
      // rows here would hand out a slot that is still taken.
      const last = await prisma.ticketTier.findFirst({
        where: { editionId: body.editionId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = last ? last.sortOrder + 1 : 0;
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
        sortOrder,
        editionId: body.editionId,
      },
    });

    revalidateBilletterie();
    return reply.status(201).send({ id: tier.id });
  });

  // PUT /api/admin/tickets/:id — update ticket tier
  app.put<{
    Params: { id: string };
    Body: Partial<TicketTierBody>;
  }>("/tickets/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const existing = await prisma.ticketTier.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return reply.status(404).send({ error: "Ticket tier not found" });

    const body = request.body;

    // manualStatus: "AUTO" or null clears the override; a valid enum sets it.
    let manualStatus = existing.manualStatus;
    if (body.manualStatus !== undefined) {
      if (body.manualStatus === null || body.manualStatus === "AUTO") {
        manualStatus = null;
      } else if (TICKET_STATUSES.includes(body.manualStatus)) {
        manualStatus = body.manualStatus;
      } else {
        return reply.status(400).send({ error: "Invalid manualStatus" });
      }
    }

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
        manualStatus,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    });

    revalidateBilletterie();
    return { id: tier.id };
  });

  // DELETE /api/admin/tickets/:id — moves the tier to the trash (#147). The row
  // survives with `deletedAt` set; #145c restores it, #145d purges it.
  app.delete<{
    Params: { id: string };
  }>("/tickets/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.ticketTier.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Ticket tier");

    // sortOrder is deliberately left untouched. The unique slot it holds under
    // `@@unique([editionId, sortOrder])` cannot be parked the way a slug can —
    // parking relies on a string prefix and sortOrder is an Int. So a trashed
    // tier keeps its slot until purged: creating a new tier at that exact
    // sortOrder fails until then. Appending (the default path in POST) is
    // unaffected, since it reads past the trashed rows too.
    await prisma.ticketTier.update({
      where: { id },
      data: softDeleteData(),
    });
    revalidateBilletterie();
    return { success: true };
  });
}
