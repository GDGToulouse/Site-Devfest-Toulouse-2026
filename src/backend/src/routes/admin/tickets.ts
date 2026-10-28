import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { computeTicketStatus } from "../editions.js";
import { revalidateBilletterie } from "../../lib/revalidate.js";
import { notDeleted, notFound, softDeleteData } from "../../lib/admin-helpers.js";
import { BILLETWEB_API, getBilletwebParams } from "../../lib/billetweb.js";

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
  isOutsideFlow?: boolean;
  editionId: number;
}

const editionIdParams = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "string", pattern: "^[0-9]+$" } },
} as const;

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

function unixToDate(ts: unknown): Date | null {
  if (!ts || ts === "") return null;
  const n = Number(ts);
  if (isNaN(n) || n === 0) return null;
  return new Date(n * 1000);
}

// Billetweb only credits a sale to the site when the shop link carries `src`
// (#507). Its API returns the bare shop URL, so the import adds the source the
// editor chose; a blank source keeps the URL as Billetweb sent it.
export function withTrackingSource(
  shopUrl: string | undefined,
  source: string | undefined,
): string | null {
  if (!shopUrl) return null;
  const src = source?.trim();
  if (!src) return shopUrl;
  try {
    const url = new URL(shopUrl);
    url.searchParams.set("src", src);
    return url.toString();
  } catch {
    return shopUrl;
  }
}

// A tier as the Billetweb import sees it: the fields Billetweb owns. Everything
// else on the row (English name once translated, manual status, "outside the
// flow") belongs to the site and survives a re-import (RG-ARR-11, #637).
export interface ImportedTier {
  billetwebTicketId: string;
  name: string;
  price: number;
  isVisible: boolean;
  saleStartDate: Date | null;
  saleEndDate: Date | null;
  isSoldOut: boolean | null;
}

interface ExistingTier {
  id: number;
  nameFr: string;
  nameEn: string;
  billetwebTicketId: string | null;
  sortOrder: number;
  deletedAt: Date | null;
}

export interface TierImportPlan {
  updates: Array<{ id: number; data: Prisma.TicketTierUncheckedUpdateInput }>;
  creates: Array<Omit<Prisma.TicketTierUncheckedCreateInput, "editionId">>;
}

// Matches Billetweb's tiers onto the edition's, by Billetweb id first, then —
// for tiers imported before ids were kept — by French name. Billetweb's order
// becomes the edition's; tiers it no longer returns go to the trash; tiers
// created by hand keep their place after the imported ones.
export function planTierImport(
  existing: ExistingTier[],
  imported: ImportedTier[],
  externalUrl: string | null,
  now: Date = new Date(),
): TierImportPlan {
  const byTicketId = new Map(
    existing.filter((t) => t.billetwebTicketId).map((t) => [t.billetwebTicketId!, t]),
  );
  const claimed = new Set<number>();
  const updates: TierImportPlan["updates"] = [];
  const creates: TierImportPlan["creates"] = [];
  let sortOrder = 0;

  for (const tier of imported) {
    const match =
      byTicketId.get(tier.billetwebTicketId) ??
      existing.find(
        (t) => !t.billetwebTicketId && !t.deletedAt && !claimed.has(t.id) && t.nameFr === tier.name,
      );
    const billetwebData = {
      nameFr: tier.name,
      price: tier.price,
      isVisible: tier.isVisible,
      saleStartDate: tier.saleStartDate,
      saleEndDate: tier.saleEndDate,
      externalUrl,
      isSoldOut: tier.isSoldOut,
      billetwebTicketId: tier.billetwebTicketId,
      sortOrder: sortOrder++,
    };
    if (match) {
      claimed.add(match.id);
      // The English name follows Billetweb's until someone translates it.
      const nameEn = match.nameEn === match.nameFr ? { nameEn: tier.name } : {};
      updates.push({ id: match.id, data: { ...billetwebData, ...nameEn } });
    } else {
      creates.push({ ...billetwebData, nameEn: tier.name });
    }
  }

  const rest = existing
    .filter((t) => !claimed.has(t.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const t of rest) {
    const isGoneFromBilletweb = t.billetwebTicketId !== null && !t.deletedAt;
    updates.push({
      id: t.id,
      data: { sortOrder: sortOrder++, ...(isGoneFromBilletweb ? softDeleteData(now) : {}) },
    });
  }

  return { updates, creates };
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

  // GET /api/admin/tickets/billetweb/link/:editionId — the edition's Billetweb event
  app.get<{ Params: { editionId: string } }>(
    "/tickets/billetweb/link/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const edition = await prisma.edition.findFirst({
        where: { id: Number(request.params.editionId), ...notDeleted },
        select: { billetwebEventId: true, billetwebEventName: true },
      });
      if (!edition) return notFound(reply, "Edition");
      return edition;
    },
  );

  // DELETE /api/admin/tickets/billetweb/link/:editionId — unlinks the event
  // (RG-ARR-10): wrong event picked, or the edition moved to another one. Tiers
  // keep their Billetweb ids, so relinking the same event loses nothing; linking
  // another one sends the old tiers to the trash at its first import.
  app.delete<{ Params: { editionId: string } }>(
    "/tickets/billetweb/link/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const id = Number(request.params.editionId);
      const edition = await prisma.edition.findFirst({ where: { id, ...notDeleted } });
      if (!edition) return notFound(reply, "Edition");
      await prisma.edition.update({
        where: { id },
        data: { billetwebEventId: null, billetwebEventName: null },
      });
      return { success: true };
    },
  );

  // POST /api/admin/tickets/import/billetweb — imports the tiers of the
  // edition's Billetweb event, linking it on the first import (#637).
  app.post<{
    Body: { editionId: number; billetwebEventId?: string; trackingSource?: string };
  }>("/tickets/import/billetweb", async (request, reply) => {
    const { editionId, trackingSource } = request.body;
    if (!editionId) {
      return reply.status(400).send({ error: "editionId is required" });
    }

    const edition = await prisma.edition.findFirst({ where: { id: editionId, ...notDeleted } });
    if (!edition) return notFound(reply, "Edition");

    const billetwebEventId = edition.billetwebEventId ?? request.body.billetwebEventId;
    if (!billetwebEventId) {
      return reply.status(400).send({ error: "billetwebEventId is required" });
    }
    if (
      edition.billetwebEventId &&
      request.body.billetwebEventId &&
      request.body.billetwebEventId !== edition.billetwebEventId
    ) {
      return reply.status(409).send({
        error: "edition_linked_elsewhere",
        message: "L'édition est liée à un autre événement Billetweb : déliez-la d'abord.",
      });
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
    const shopUrl = withTrackingSource(eventData[0]?.shop as string | undefined, trackingSource);

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

    const imported: ImportedTier[] = tickets
      .filter((t) => String(t.id ?? "") !== "")
      .map((t) => {
        const visibility = Number(t.visibility);
        return {
          billetwebTicketId: String(t.id),
          name: String(t.name || ""),
          price: Number(t.price) || 0,
          isVisible: visibility === 0 || visibility === 1,
          saleStartDate: unixToDate(t.start_time),
          saleEndDate: unixToDate(t.end_time),
          isSoldOut: soldOutByTicket.get(String(t.id)) ?? null,
        };
      });

    // Trashed tiers too: they still hold their sortOrder slot and Billetweb id.
    const existing = await prisma.ticketTier.findMany({
      where: { editionId },
      select: { id: true, nameFr: true, nameEn: true, billetwebTicketId: true, sortOrder: true, deletedAt: true },
    });
    const plan = planTierImport(existing, imported, shopUrl);

    // Tiers are updated in place, so their ids and site settings survive
    // (#637) — the import used to delete and recreate them. Renumbering under
    // `@@unique([editionId, sortOrder])` first parks every slot at -id: no two
    // collide, and none clashes with the final 0..n-1. Raw on purpose, so the
    // history does not log a throwaway value for each tier.
    await prisma.$transaction([
      prisma.$executeRaw`UPDATE "TicketTier" SET "sortOrder" = -"id" WHERE "editionId" = ${editionId}`,
      ...plan.updates.map((u) => prisma.ticketTier.update({ where: { id: u.id }, data: u.data })),
      ...plan.creates.map((data) =>
        prisma.ticketTier.create({ data: { ...data, editionId } }),
      ),
      ...(edition.billetwebEventId
        ? []
        : [
            prisma.edition.update({
              where: { id: editionId },
              data: {
                billetwebEventId,
                billetwebEventName: String(eventData[0]?.name ?? "") || null,
              },
            }),
          ]),
    ]);

    revalidateBilletterie();
    return reply.status(201).send({ imported: imported.length });
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
      billetwebTicketId: t.billetwebTicketId,
      isOutsideFlow: t.isOutsideFlow,
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
        isOutsideFlow: body.isOutsideFlow ?? false,
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
        isOutsideFlow: body.isOutsideFlow ?? existing.isOutsideFlow,
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
