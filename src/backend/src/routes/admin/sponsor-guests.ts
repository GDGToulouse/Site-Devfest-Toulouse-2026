import type { FastifyInstance, FastifyReply } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { notDeleted } from "../../lib/admin-helpers.js";
import { getAuthContext } from "../../lib/auth-context.js";
import {
  ADJUSTMENT_REASONS,
  addGuests,
  guestBodySchema,
  guestData,
  guestSelect,
  loadGuestBook,
  quotaOf,
  rankGuests,
  registrationEditionSelect,
  registrationState,
  requireSponsorGuestsEnabled,
  type GuestBody,
} from "../../lib/sponsor-guests.js";
import { guestCsvTemplate, prepareGuestImport, previewGuestImport } from "../../lib/sponsor-guest-csv.js";

// Sponsor guests in the back-office (#727, #730). The team is not bound by the
// sponsors' rules: it adds a guest after the deadline, while registration is
// closed, past the quota — that guest is then out of quota, gets no ticket, and
// shows in the alerts (RG-INS-15, RG-INS-22). A guest with a ticket stays
// read-only here too: Billetweb is the reference once it exists (RG-INS-27).

const idParam = { type: "string", pattern: "^[0-9]+$" } as const;

const participationParams = {
  type: "object",
  required: ["id", "editionId"],
  properties: { id: idParam, editionId: idParam },
} as const;

const GUEST_PAGE_SIZE = 50;
const GUEST_PAGE_SIZE_MAX = 200;
const GUEST_FILTERS = ["outOfQuota", "duplicates", "withTicket", "withoutTicket", "errors"] as const;
const IMPORT_MAX_BASE64 = 250_000;

interface GuestListQuery {
  sponsorId?: string;
  filter?: (typeof GUEST_FILTERS)[number];
  search?: string;
  page?: string;
  limit?: string;
}

async function findParticipation(sponsorId: number, editionId: number) {
  return prisma.editionSponsor.findFirst({
    where: { sponsorId, editionId, sponsor: notDeleted, edition: notDeleted },
    select: { id: true, editionId: true, tierId: true },
  });
}

function participationNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "Participation not found" });
}

/**
 * Every participation of an edition with its guests ranked. Read whole and
 * filtered in memory: ranking needs all of a sponsor's guests anyway, and an
 * edition has a few hundred at most — 40 sponsors with 8 places is 320.
 */
async function loadEditionGuests(editionId: number) {
  const participations = await prisma.editionSponsor.findMany({
    where: { editionId, sponsor: notDeleted },
    select: {
      id: true,
      editionId: true,
      tierId: true,
      sponsor: { select: { id: true, name: true } },
      guests: { select: guestSelect },
      guestAdjustments: { select: { quantity: true } },
    },
    orderBy: { sponsor: { name: "asc" } },
  });
  const offers = await prisma.editionSponsorTier.findMany({
    where: { editionId },
    select: { tierId: true, guestPlaces: true },
  });
  const placesByTier = new Map(offers.map((o) => [o.tierId, o.guestPlaces]));

  return participations.map((p) => {
    const quota = quotaOf(placesByTier.get(p.tierId) ?? 0, p.guestAdjustments);
    const guests = rankGuests(p.guests, quota.quota);
    return {
      participationId: p.id,
      sponsor: p.sponsor,
      ...quota,
      registeredCount: guests.length,
      outOfQuotaCount: guests.filter((g) => !g.isWithinQuota).length,
      guests,
    };
  });
}

interface FilterableGuest {
  isWithinQuota: boolean;
  hasDuplicateEmail: boolean;
  billetwebTicketId: string | null;
  billetwebError: string | null;
  isBilletwebCancelled: boolean;
}

function matchesFilter(guest: FilterableGuest, filter: GuestListQuery["filter"]) {
  switch (filter) {
    case "outOfQuota":
      return !guest.isWithinQuota;
    case "duplicates":
      return guest.hasDuplicateEmail;
    case "withTicket":
      return guest.billetwebTicketId !== null;
    case "withoutTicket":
      return guest.billetwebTicketId === null;
    case "errors":
      return guest.billetwebError !== null || guest.isBilletwebCancelled;
    default:
      return true;
  }
}

function squash(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default async function adminSponsorGuestRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireSponsorGuestsEnabled);

  // GET /api/admin/editions/:id/sponsor-guests — every guest of the
  // edition, with the sponsors' counters and the alerts (#730).
  app.get<{ Params: { id: string }; Querystring: GuestListQuery }>(
    "/editions/:id/sponsor-guests",
    {
      schema: {
        // `:id`, as every other /editions/:id route: a second name at the same
        // place breaks Fastify's route tree printing (route-guards.test.ts).
        params: { type: "object", required: ["id"], properties: { id: idParam } },
        querystring: {
          type: "object",
          properties: {
            sponsorId: idParam,
            filter: { type: "string", enum: GUEST_FILTERS },
            search: { type: "string", maxLength: 200 },
            page: idParam,
            limit: idParam,
          },
        },
      },
    },
    async (request, reply) => {
      const editionId = Number(request.params.id);
      const edition = await prisma.edition.findFirst({
        where: { id: editionId, ...notDeleted },
        select: registrationEditionSelect,
      });
      if (!edition) return reply.code(404).send({ error: "Edition not found" });

      const sponsors = await loadEditionGuests(editionId);
      const all = sponsors.flatMap((s) => s.guests.map((g) => ({ ...g, sponsor: s.sponsor })));

      const sponsorId = request.query.sponsorId ? Number(request.query.sponsorId) : null;
      const search = squash(request.query.search?.trim() ?? "");
      const filtered = all.filter(
        (g) =>
          (sponsorId === null || g.sponsor.id === sponsorId) &&
          matchesFilter(g, request.query.filter) &&
          (!search || squash(`${g.firstName} ${g.lastName} ${g.email} ${g.sponsor.name}`).includes(search)),
      );

      const limit = Math.min(Number(request.query.limit) || GUEST_PAGE_SIZE, GUEST_PAGE_SIZE_MAX);
      const page = Math.max(1, Number(request.query.page) || 1);

      return {
        registration: registrationState(edition),
        sponsors: sponsors.map(({ guests: _guests, ...s }) => s),
        alerts: {
          outOfQuota: all.filter((g) => !g.isWithinQuota).length,
          outOfQuotaWithTicket: all.filter((g) => !g.isWithinQuota && g.billetwebTicketId !== null).length,
          duplicates: all.filter((g) => g.hasDuplicateEmail).length,
          errors: all.filter((g) => g.billetwebError !== null || g.isBilletwebCancelled).length,
        },
        page,
        limit,
        total: filtered.length,
        items: filtered.slice((page - 1) * limit, page * limit),
      };
    },
  );

  // GET /api/admin/sponsors/:id/editions/:editionId/guests — one sponsor's
  // places, adjustments and guests, for its back-office card (#727).
  app.get<{ Params: { id: string; editionId: string } }>(
    "/sponsors/:id/editions/:editionId/guests",
    { schema: { params: participationParams } },
    async (request, reply) => {
      const participation = await findParticipation(Number(request.params.id), Number(request.params.editionId));
      if (!participation) return participationNotFound(reply);
      return loadGuestBook(participation.id);
    },
  );

  // POST /api/admin/sponsors/:id/editions/:editionId/guest-adjustments — places
  // bought separately, a gesture, a correction (RG-INS-11).
  app.post<{
    Params: { id: string; editionId: string };
    Body: { quantity: number; reason: (typeof ADJUSTMENT_REASONS)[number]; comment?: string };
  }>(
    "/sponsors/:id/editions/:editionId/guest-adjustments",
    {
      schema: {
        params: participationParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["quantity", "reason"],
          properties: {
            quantity: { type: "integer", minimum: -1000, maximum: 1000, not: { const: 0 } },
            reason: { type: "string", enum: ADJUSTMENT_REASONS },
            comment: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const participation = await findParticipation(Number(request.params.id), Number(request.params.editionId));
      if (!participation) return participationNotFound(reply);
      const ctx = await getAuthContext(request);

      const adjustment = await prisma.sponsorGuestAdjustment.create({
        data: {
          editionSponsorId: participation.id,
          quantity: request.body.quantity,
          reason: request.body.reason,
          comment: request.body.comment?.trim() || null,
          createdById: ctx?.user.id ?? null,
        },
        select: { id: true },
      });
      return reply.code(201).send(adjustment);
    },
  );

  // DELETE /api/admin/sponsor-guest-adjustments/:adjustmentId — withdraws a
  // line entered by mistake; the history keeps it.
  app.delete<{ Params: { adjustmentId: string } }>(
    "/sponsor-guest-adjustments/:adjustmentId",
    { schema: { params: { type: "object", required: ["adjustmentId"], properties: { adjustmentId: idParam } } } },
    async (request, reply) => {
      const { count } = await prisma.sponsorGuestAdjustment.deleteMany({
        where: { id: Number(request.params.adjustmentId) },
      });
      if (count === 0) return reply.code(404).send({ error: "Adjustment not found" });
      return reply.code(204).send();
    },
  );

  // POST /api/admin/sponsors/:id/editions/:editionId/guests — the team adds a
  // guest, at any time and past the quota (RG-INS-22).
  app.post<{ Params: { id: string; editionId: string }; Body: GuestBody }>(
    "/sponsors/:id/editions/:editionId/guests",
    { schema: { params: participationParams, body: guestBodySchema } },
    async (request, reply) => {
      const participation = await findParticipation(Number(request.params.id), Number(request.params.editionId));
      if (!participation) return participationNotFound(reply);
      const parsed = guestData(request.body);
      if ("field" in parsed) return reply.code(400).send({ error: "invalid_field", field: parsed.field });

      const [guest] = await addGuests(participation, [parsed.data], { enforceQuota: false });
      return reply.code(201).send({ id: guest.id });
    },
  );

  // POST /api/admin/sponsors/:id/editions/:editionId/guests/import — the CSV
  // import of the sponsor space (#729), without the quota: lines past it are
  // imported and shown out of quota (RG-INS-34).
  app.post<{ Params: { id: string; editionId: string }; Body: { file: string; confirm?: boolean } }>(
    "/sponsors/:id/editions/:editionId/guests/import",
    {
      schema: {
        params: participationParams,
        body: {
          type: "object",
          required: ["file"],
          additionalProperties: false,
          properties: {
            file: { type: "string", minLength: 1, maxLength: IMPORT_MAX_BASE64 },
            confirm: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const participation = await findParticipation(Number(request.params.id), Number(request.params.editionId));
      if (!participation) return participationNotFound(reply);

      const prepared = prepareGuestImport(Buffer.from(request.body.file, "base64"));
      if (!prepared.ok) return reply.code(422).send(prepared.payload);
      const { rows } = prepared;

      if (!request.body.confirm) {
        const book = await loadGuestBook(participation.id);
        return {
          count: rows.length,
          remaining: book.remaining,
          // Not refused here: the team may go past it, and is told by how much.
          outOfQuota: Math.max(0, rows.length - book.remaining),
          guests: previewGuestImport(rows, book.guests.map((g) => g.email)),
        };
      }
      const created = await addGuests(participation, rows.map((r) => r.data), { enforceQuota: false });
      return reply.code(201).send({ created: created.length });
    },
  );

  // GET /api/admin/sponsor-guests/template — the same CSV as the sponsors'.
  app.get("/sponsor-guests/template", async (_request, reply) => {
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="modele-invites-devfest.csv"')
      .send(guestCsvTemplate());
  });

  // PUT /api/admin/sponsor-guests/:guestId — corrects a guest without a ticket.
  app.put<{ Params: { guestId: string }; Body: GuestBody }>(
    "/sponsor-guests/:guestId",
    {
      schema: {
        params: { type: "object", required: ["guestId"], properties: { guestId: idParam } },
        body: guestBodySchema,
      },
    },
    async (request, reply) => {
      const guest = await prisma.sponsorGuest.findUnique({
        where: { id: Number(request.params.guestId) },
        select: { id: true, billetwebTicketId: true },
      });
      if (!guest) return reply.code(404).send({ error: "Guest not found" });
      if (guest.billetwebTicketId) return reply.code(409).send({ error: "guest_has_ticket" });

      const parsed = guestData(request.body);
      if ("field" in parsed) return reply.code(400).send({ error: "invalid_field", field: parsed.field });
      await prisma.sponsorGuest.update({ where: { id: guest.id }, data: parsed.data });
      return { saved: true };
    },
  );

  // DELETE /api/admin/sponsor-guests/:guestId — removes a guest without a
  // ticket. One with a ticket is cancelled through Billetweb (#731) instead,
  // or the person would keep a valid ticket the site no longer knows about.
  app.delete<{ Params: { guestId: string } }>(
    "/sponsor-guests/:guestId",
    { schema: { params: { type: "object", required: ["guestId"], properties: { guestId: idParam } } } },
    async (request, reply) => {
      const guest = await prisma.sponsorGuest.findUnique({
        where: { id: Number(request.params.guestId) },
        select: { id: true, billetwebTicketId: true },
      });
      if (!guest) return reply.code(404).send({ error: "Guest not found" });
      if (guest.billetwebTicketId) return reply.code(409).send({ error: "guest_has_ticket" });
      await prisma.sponsorGuest.delete({ where: { id: guest.id } });
      return reply.code(204).send();
    },
  );
}

