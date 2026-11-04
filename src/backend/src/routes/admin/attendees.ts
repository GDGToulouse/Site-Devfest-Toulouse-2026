import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound } from "../../lib/admin-helpers.js";
import { importAttendees, type AttendeeImportRefusal } from "../../lib/attendee-import.js";

const editionIdParams = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "string", pattern: "^[0-9]+$" } },
} as const;

const IMPORT_REFUSALS: Record<Exclude<AttendeeImportRefusal, "not_found">, { status: number; body: object }> = {
  edition_not_linked: {
    status: 409,
    body: {
      error: "edition_not_linked",
      message: "L'édition n'est liée à aucun événement Billetweb : importez d'abord ses tarifs.",
    },
  },
  attendees_purged: {
    status: 409,
    body: {
      error: "attendees_purged",
      message: "Les données des participants de cette édition ont été supprimées au terme de leur conservation.",
    },
  },
  credentials_missing: { status: 400, body: { error: "Billetweb API credentials not configured" } },
  import_running: {
    status: 409,
    body: { error: "import_running", message: "Un import est déjà en cours pour cette édition." },
  },
  billetweb_error: {
    status: 502,
    body: { error: "billetweb_error", message: "Billetweb n'a pas renvoyé les participants. Réessayez dans une minute." },
  },
};

export default async function adminAttendeeRoutes(app: FastifyInstance) {
  // POST /api/admin/attendees/import/:editionId — imports the attendees of the
  // edition's linked Billetweb event (RG-ARR-12). The same import runs every
  // five minutes while the stations are open (#800, lib/attendee-import.ts).
  app.post<{ Params: { editionId: string } }>(
    "/attendees/import/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const result = await importAttendees(Number(request.params.editionId), request.log);
      if (result.ok) return reply.status(201).send(result.report);
      if (result.reason === "not_found") return notFound(reply, "Edition");
      const { status, body } = IMPORT_REFUSALS[result.reason];
      return reply.status(status).send(body);
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
        select: { billetwebEventId: true, attendeesSyncedAt: true, attendeesSyncError: true, attendeesPurgedAt: true },
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
        // The last attempt's failure, by hand or by the five-minute sync (#800).
        syncError: edition.attendeesSyncError,
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
