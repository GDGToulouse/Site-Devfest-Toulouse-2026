import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound } from "../../lib/admin-helpers.js";
import { BILLETWEB_API, getBilletwebParams } from "../../lib/billetweb.js";
import { parseWallTime } from "../../lib/zoned-time.js";

const editionIdParams = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "string", pattern: "^[0-9]+$" } },
} as const;

// Billetweb's `last_update` is a wall-clock time we cannot compare to ours to the
// second: the incremental import goes back this far before the last one.
const SYNC_OVERLAP_SECONDS = 10 * 60;

// Billetweb's ticket form has no fixed "company" field: each organiser names it.
const COMPANY_FIELD = /entreprise|soci[eé]t[eé]|company|organi[sz]ation|employeur/i;

// The fields of an Attendee that Billetweb owns — all of them.
export interface ImportedAttendee {
  billetwebId: string;
  barcode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  billetwebTicketId: string;
  category: string | null;
  orderId: string;
  orderDate: Date;
  isCancelled: boolean;
}

type ExistingAttendee = ImportedAttendee & { id: number; ticketTierId: number | null };

export interface AttendeeImportPlan {
  creates: Array<ImportedAttendee & { ticketTierId: number | null }>;
  updates: Array<{ id: number; data: Prisma.AttendeeUncheckedUpdateInput }>;
  cancelled: number;
  unchanged: number;
}

function pickCompany(...fields: unknown[]): string | null {
  for (const custom of fields) {
    if (!custom || typeof custom !== "object") continue;
    for (const [name, value] of Object.entries(custom)) {
      if (COMPANY_FIELD.test(name) && String(value ?? "").trim()) return String(value).trim();
    }
  }
  return null;
}

/** One row of Billetweb's /event/:id/attendees, or null when it cannot be keyed. */
export function toImportedAttendee(row: Record<string, unknown>): ImportedAttendee | null {
  const billetwebId = String(row.id ?? "");
  // Paris wall time, written "2026-09-01 10:00:00" by Billetweb.
  const orderDate = parseWallTime(String(row.order_date ?? "").replace(" ", "T"));
  if (!billetwebId || !orderDate) return null;
  const text = (value: unknown) => String(value ?? "").trim() || null;
  return {
    billetwebId,
    barcode: String(row.barcode ?? ""),
    firstName: String(row.firstname ?? "").trim(),
    lastName: String(row.name ?? "").trim(),
    email: text(row.email),
    company: pickCompany(row.custom, row.custom_order),
    billetwebTicketId: String(row.ticket_id ?? ""),
    category: text(row.category),
    orderId: String(row.order_id ?? ""),
    orderDate,
    // "1" refunded or cancelled, "2" order deleted: undocumented, seen on the
    // test event (2026-10-28). Anything but "0" keeps the ticket out of the arrivals.
    isCancelled: String(row.disabled ?? "0") !== "0",
  };
}

const COMPARED_FIELDS = [
  "barcode", "firstName", "lastName", "email", "company", "billetwebTicketId", "category", "orderId", "isCancelled",
] as const;

/**
 * What an import writes: new tickets created, known ones updated only where a
 * field moved, so a second import with nothing new on Billetweb writes nothing.
 */
export function planAttendeeImport(
  existing: ExistingAttendee[],
  imported: ImportedAttendee[],
  tierIdByTicket: Map<string, number>,
): AttendeeImportPlan {
  const byBilletwebId = new Map(existing.map((a) => [a.billetwebId, a]));
  const plan: AttendeeImportPlan = { creates: [], updates: [], cancelled: 0, unchanged: 0 };

  for (const row of imported) {
    const ticketTierId = tierIdByTicket.get(row.billetwebTicketId) ?? null;
    const current = byBilletwebId.get(row.billetwebId);
    if (!current) {
      plan.creates.push({ ...row, ticketTierId });
      continue;
    }
    const data: Prisma.AttendeeUncheckedUpdateInput = {};
    for (const field of COMPARED_FIELDS) {
      if (current[field] !== row[field]) Object.assign(data, { [field]: row[field] });
    }
    if (current.orderDate.getTime() !== row.orderDate.getTime()) data.orderDate = row.orderDate;
    if (current.ticketTierId !== ticketTierId) data.ticketTierId = ticketTierId;
    if (Object.keys(data).length === 0) {
      plan.unchanged++;
      continue;
    }
    if (row.isCancelled && !current.isCancelled) plan.cancelled++;
    plan.updates.push({ id: current.id, data });
  }
  return plan;
}

// One import at a time per edition: Billetweb allows 10 calls a minute on
// /attendees, and two clicks must not race on the same rows.
const runningImports = new Set<number>();

export default async function adminAttendeeRoutes(app: FastifyInstance) {
  // POST /api/admin/attendees/import/:editionId — imports the attendees of the
  // edition's linked Billetweb event (RG-ARR-12). One call to Billetweb per
  // import; after the first, only what changed since the last one.
  app.post<{ Params: { editionId: string } }>(
    "/attendees/import/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const editionId = Number(request.params.editionId);
      const edition = await prisma.edition.findFirst({ where: { id: editionId, ...notDeleted } });
      if (!edition) return notFound(reply, "Edition");
      if (!edition.billetwebEventId) {
        return reply.status(409).send({
          error: "edition_not_linked",
          message: "L'édition n'est liée à aucun événement Billetweb : importez d'abord ses tarifs.",
        });
      }
      // Deleted at the end of their retention (RG-ARR-66): never fetched again.
      if (edition.attendeesPurgedAt) {
        return reply.status(409).send({
          error: "attendees_purged",
          message: "Les données des participants de cette édition ont été supprimées au terme de leur conservation.",
        });
      }
      const params = getBilletwebParams();
      if (!params) {
        return reply.status(400).send({ error: "Billetweb API credentials not configured" });
      }
      if (runningImports.has(editionId)) {
        return reply.status(409).send({
          error: "import_running",
          message: "Un import est déjà en cours pour cette édition.",
        });
      }

      runningImports.add(editionId);
      try {
        const startedAt = new Date();
        // disabled=1: refunded and cancelled tickets too, so they get marked.
        params.set("disabled", "1");
        if (edition.attendeesSyncedAt) {
          const since = Math.floor(edition.attendeesSyncedAt.getTime() / 1000) - SYNC_OVERLAP_SECONDS;
          params.set("last_update", String(since));
        }
        const res = await fetch(
          `${BILLETWEB_API}/event/${encodeURIComponent(edition.billetwebEventId)}/attendees?${params}`,
        );
        const body = (await res.json().catch(() => null)) as unknown;
        // Billetweb reports most errors (rights, rate limit) as a 200 with an `error`.
        if (!res.ok || !Array.isArray(body)) {
          request.log.warn({ editionId, status: res.status, body }, "Billetweb attendees import failed");
          return reply.status(502).send({
            error: "billetweb_error",
            message: "Billetweb n'a pas renvoyé les participants. Réessayez dans une minute.",
          });
        }

        const imported = (body as Array<Record<string, unknown>>)
          .map(toImportedAttendee)
          .filter((a): a is ImportedAttendee => a !== null);

        const [existing, tiers] = await Promise.all([
          prisma.attendee.findMany({
            where: { editionId, billetwebId: { in: imported.map((a) => a.billetwebId) } },
          }),
          // Trashed tiers too: a ticket still points to its tier once it is binned.
          prisma.ticketTier.findMany({
            where: { editionId, billetwebTicketId: { not: null } },
            select: { id: true, billetwebTicketId: true },
          }),
        ]);
        const tierIdByTicket = new Map(tiers.map((t) => [t.billetwebTicketId as string, t.id]));
        const plan = planAttendeeImport(existing, imported, tierIdByTicket);

        await prisma.$transaction([
          prisma.attendee.createMany({ data: plan.creates.map((a) => ({ ...a, editionId })) }),
          ...plan.updates.map((u) => prisma.attendee.update({ where: { id: u.id }, data: u.data })),
          // A ticket imported before its tier stays unlinked: the incremental
          // import will not bring it back, so each import catches up here.
          ...tiers.map((t) =>
            prisma.attendee.updateMany({
              where: { editionId, ticketTierId: null, billetwebTicketId: t.billetwebTicketId as string },
              data: { ticketTierId: t.id },
            }),
          ),
          prisma.edition.update({ where: { id: editionId }, data: { attendeesSyncedAt: startedAt } }),
        ]);

        const withoutTier = await prisma.attendee.count({ where: { editionId, ticketTierId: null } });
        return reply.status(201).send({
          isIncremental: edition.attendeesSyncedAt !== null,
          received: imported.length,
          created: plan.creates.length,
          updated: plan.updates.length,
          cancelled: plan.cancelled,
          unchanged: plan.unchanged,
          withoutTier,
        });
      } finally {
        runningImports.delete(editionId);
      }
    },
  );

  // GET /api/admin/attendees/summary/:editionId — counts per tier, no personal
  // data: the back-office only needs to see that the import landed.
  app.get<{ Params: { editionId: string } }>(
    "/attendees/summary/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const editionId = Number(request.params.editionId);
      const edition = await prisma.edition.findFirst({
        where: { id: editionId, ...notDeleted },
        select: { billetwebEventId: true, attendeesSyncedAt: true, attendeesPurgedAt: true },
      });
      if (!edition) return notFound(reply, "Edition");

      const [groups, tiers] = await Promise.all([
        prisma.attendee.groupBy({
          by: ["ticketTierId", "isCancelled"],
          where: { editionId },
          _count: { _all: true },
        }),
        prisma.ticketTier.findMany({
          where: { editionId },
          select: { id: true, nameFr: true, isOutsideFlow: true, sortOrder: true, deletedAt: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
      const countOf = (tierId: number | null, isCancelled: boolean) =>
        groups.find((g) => g.ticketTierId === tierId && g.isCancelled === isCancelled)?._count._all ?? 0;

      const byTier = tiers
        .map((t) => ({
          ticketTierId: t.id,
          name: t.nameFr,
          isOutsideFlow: t.isOutsideFlow,
          expected: countOf(t.id, false),
          cancelled: countOf(t.id, true),
        }))
        // A binned tier only shows while tickets still point to it.
        .filter((t, i) => t.expected + t.cancelled > 0 || !tiers[i].deletedAt);
      const sum = (pick: (t: (typeof byTier)[number]) => number) => byTier.reduce((n, t) => n + pick(t), 0);

      return {
        billetwebEventId: edition.billetwebEventId,
        syncedAt: edition.attendeesSyncedAt,
        purgedAt: edition.attendeesPurgedAt,
        expected: sum((t) => t.expected) + countOf(null, false),
        cancelled: sum((t) => t.cancelled) + countOf(null, true),
        outsideFlow: sum((t) => (t.isOutsideFlow ? t.expected : 0)),
        withoutTier: countOf(null, false) + countOf(null, true),
        byTier,
      };
    },
  );
}
