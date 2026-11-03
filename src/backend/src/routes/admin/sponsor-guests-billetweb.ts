import type { FastifyInstance, FastifyReply } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { notDeleted } from "../../lib/admin-helpers.js";
import { requireAdminRole } from "../../lib/admin-guard.js";
import {
  BilletwebError,
  deleteOrders,
  hasBilletwebCredentials,
  listAttendees,
  listEventTickets,
} from "../../lib/billetweb-client.js";
import {
  guestFromAttendee,
  loadSyncSettings,
  previewSync,
  resolveFieldMap,
  runSync,
} from "../../lib/sponsor-guest-billetweb.js";
import { addGuests, GUEST_EXPERIENCES, GUEST_GENDERS, requireSponsorGuestsEnabled } from "../../lib/sponsor-guests.js";

// Sponsor guests ↔ Billetweb (#731, #732). Reading the settings and the
// preview is the team's; everything that creates, cancels or links a ticket in
// Billetweb is an ADMIN's, as is choosing where tickets go — a wrong tariff
// would send real tickets to real people.

const idParam = { type: "string", pattern: "^[0-9]+$" } as const;
const editionParams = { type: "object", required: ["id"], properties: { id: idParam } } as const;

// One sync per edition at a time: two admins clicking together would each read
// the guests without a ticket and create them twice. In memory, which holds
// with one backend replica (architecture.md, node-cron has the same limit).
const syncing = new Set<number>();

function billetwebFailure(reply: FastifyReply, err: unknown) {
  if (err instanceof BilletwebError) return reply.code(502).send({ error: "billetweb_error", message: err.message });
  throw err;
}

export default async function adminSponsorGuestBilletwebRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireSponsorGuestsEnabled);

  // GET /api/admin/editions/:id/sponsor-guests/billetweb — where tickets go.
  app.get<{ Params: { id: string } }>(
    "/editions/:id/sponsor-guests/billetweb",
    { schema: { params: editionParams } },
    async (request, reply) => {
      const edition = await prisma.edition.findFirst({
        where: { id: Number(request.params.id), ...notDeleted },
        select: {
          sponsorGuestBilletwebEventId: true,
          sponsorGuestBilletwebTicketId: true,
          sponsorGuestBilletwebTicketName: true,
        },
      });
      if (!edition) return reply.code(404).send({ error: "Edition not found" });
      return {
        eventId: edition.sponsorGuestBilletwebEventId,
        ticketId: edition.sponsorGuestBilletwebTicketId,
        ticketName: edition.sponsorGuestBilletwebTicketName,
        hasCredentials: hasBilletwebCredentials(),
      };
    },
  );

  // GET /api/admin/editions/:id/sponsor-guests/billetweb/tickets?eventId= —
  // the event's tariffs to pick from (RG-INS-47).
  app.get<{ Params: { id: string }; Querystring: { eventId: string } }>(
    "/editions/:id/sponsor-guests/billetweb/tickets",
    {
      schema: {
        params: editionParams,
        querystring: {
          type: "object",
          required: ["eventId"],
          properties: { eventId: { type: "string", pattern: "^[0-9]+$" } },
        },
      },
    },
    async (request, reply) => {
      try {
        const tickets = await listEventTickets(request.query.eventId);
        return tickets.map((t) => ({ id: String(t.id), name: t.full_name || t.name }));
      } catch (err) {
        return billetwebFailure(reply, err);
      }
    },
  );

  // PUT /api/admin/editions/:id/sponsor-guests/billetweb — sets the target.
  app.put<{ Params: { id: string }; Body: { eventId: string | null; ticketId: string | null; ticketName?: string | null } }>(
    "/editions/:id/sponsor-guests/billetweb",
    {
      preHandler: [requireAdminRole],
      schema: {
        params: editionParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["eventId", "ticketId"],
          properties: {
            eventId: { type: ["string", "null"], pattern: "^[0-9]+$" },
            ticketId: { type: ["string", "null"], pattern: "^[0-9]+$" },
            ticketName: { type: ["string", "null"], maxLength: 300 },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      const edition = await prisma.edition.findFirst({ where: { id, ...notDeleted }, select: { id: true } });
      if (!edition) return reply.code(404).send({ error: "Edition not found" });
      const { eventId, ticketId, ticketName } = request.body;
      await prisma.edition.update({
        where: { id },
        data: {
          sponsorGuestBilletwebEventId: eventId,
          // A tariff belongs to its event: no event, no tariff.
          sponsorGuestBilletwebTicketId: eventId ? ticketId : null,
          sponsorGuestBilletwebTicketName: eventId && ticketId ? (ticketName ?? null) : null,
        },
      });
      return { saved: true };
    },
  );

  // GET /api/admin/editions/:id/sponsor-guests/billetweb/preview — what a sync
  // would do, without calling Billetweb (RG-INS-41).
  app.get<{ Params: { id: string }; Querystring: { sponsorId?: string } }>(
    "/editions/:id/sponsor-guests/billetweb/preview",
    {
      schema: {
        params: editionParams,
        querystring: { type: "object", properties: { sponsorId: idParam } },
      },
    },
    async (request) => {
      const sponsorId = request.query.sponsorId ? Number(request.query.sponsorId) : null;
      return previewSync(Number(request.params.id), sponsorId);
    },
  );

  // POST /api/admin/editions/:id/sponsor-guests/billetweb/sync — creates the
  // missing tickets and reads back the existing ones (RG-INS-40).
  app.post<{ Params: { id: string }; Body: { sponsorId?: number } }>(
    "/editions/:id/sponsor-guests/billetweb/sync",
    {
      preHandler: [requireAdminRole],
      schema: {
        params: editionParams,
        body: {
          type: "object",
          additionalProperties: false,
          properties: { sponsorId: { type: "integer", minimum: 1 } },
        },
      },
    },
    async (request, reply) => {
      const editionId = Number(request.params.id);
      const settings = await loadSyncSettings(editionId);
      if ("error" in settings) return reply.code(422).send({ error: "billetweb_not_configured", message: settings.error });
      if (syncing.has(editionId)) {
        return reply.code(409).send({ error: "sync_running", message: "Une synchronisation est déjà en cours pour cette édition." });
      }
      syncing.add(editionId);
      try {
        return await runSync(editionId, request.body?.sponsorId ?? null, settings);
      } catch (err) {
        return billetwebFailure(reply, err);
      } finally {
        syncing.delete(editionId);
      }
    },
  );

  // POST /api/admin/sponsor-guests/:guestId/cancel-ticket — cancels the
  // guest's order in Billetweb, then removes the guest and frees the place
  // (RG-INS-26, RG-INS-45). Only orders the site created can be deleted this
  // way: Billetweb refuses `delete_order` on an order paid online.
  app.post<{ Params: { guestId: string } }>(
    "/sponsor-guests/:guestId/cancel-ticket",
    {
      preHandler: [requireAdminRole],
      schema: { params: { type: "object", required: ["guestId"], properties: { guestId: idParam } } },
    },
    async (request, reply) => {
      const guest = await prisma.sponsorGuest.findUnique({
        where: { id: Number(request.params.guestId) },
        select: { id: true, billetwebOrderId: true, editionSponsor: { select: { editionId: true } } },
      });
      if (!guest) return reply.code(404).send({ error: "Guest not found" });
      if (!guest.billetwebOrderId) return reply.code(409).send({ error: "guest_has_no_ticket" });
      const settings = await loadSyncSettings(guest.editionSponsor.editionId);
      if ("error" in settings) return reply.code(422).send({ error: "billetweb_not_configured", message: settings.error });

      try {
        await deleteOrders(settings.eventId, [Number(guest.billetwebOrderId)]);
      } catch (err) {
        return billetwebFailure(reply, err);
      }
      await prisma.sponsorGuest.delete({ where: { id: guest.id } });
      return reply.code(204).send();
    },
  );

  // POST /api/admin/sponsors/:id/editions/:editionId/guests/attach — links a
  // ticket already in Billetweb to a sponsor, by its id or printed reference
  // (#732, RG-INS-49). Without `confirm`, shows whose ticket it is.
  app.post<{
    Params: { id: string; editionId: string };
    Body: { ticket: string; confirm?: boolean; gender?: string; experience?: string };
  }>(
    "/sponsors/:id/editions/:editionId/guests/attach",
    {
      preHandler: [requireAdminRole],
      schema: {
        params: { type: "object", required: ["id", "editionId"], properties: { id: idParam, editionId: idParam } },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["ticket"],
          properties: {
            ticket: { type: "string", minLength: 1, maxLength: 60 },
            confirm: { type: "boolean" },
            // For a ticket whose form left these empty: the guest needs them.
            gender: { type: "string", enum: GUEST_GENDERS },
            experience: { type: "string", enum: GUEST_EXPERIENCES },
          },
        },
      },
    },
    async (request, reply) => {
      const editionId = Number(request.params.editionId);
      const participation = await prisma.editionSponsor.findFirst({
        where: { sponsorId: Number(request.params.id), editionId, sponsor: notDeleted, edition: notDeleted },
        select: { id: true, editionId: true, tierId: true },
      });
      if (!participation) return reply.code(404).send({ error: "Participation not found" });
      const settings = await loadSyncSettings(editionId);
      if ("error" in settings) return reply.code(422).send({ error: "billetweb_not_configured", message: settings.error });

      const ticket = request.body.ticket.trim();
      let attendee;
      let fields;
      try {
        // An id is digits; the printed reference looks like « T356-3899-E1000 ».
        const filter: Record<string, string> = /^[0-9]+$/.test(ticket) ? { product_id: ticket } : { ext_id: ticket };
        [attendee] = await listAttendees(settings.eventId, filter);
        fields = attendee ? await resolveFieldMap(settings.eventId, String(attendee.ticket_id ?? settings.ticketId)) : null;
      } catch (err) {
        return billetwebFailure(reply, err);
      }
      if (!attendee) return reply.code(404).send({ error: "ticket_not_found", message: "Aucun billet ne porte ce numéro dans l'événement." });
      if (attendee.disabled === "1") {
        return reply.code(409).send({ error: "ticket_cancelled", message: "Ce billet est annulé ou remboursé dans Billetweb." });
      }
      const holder = await prisma.sponsorGuest.findUnique({
        where: { billetwebTicketId: String(attendee.id) },
        select: { editionSponsor: { select: { sponsor: { select: { name: true } } } } },
      });
      if (holder) {
        return reply.code(409).send({
          error: "ticket_already_attached",
          message: `Ce billet est déjà rattaché à ${holder.editionSponsor.sponsor.name}.`,
        });
      }

      const read = guestFromAttendee(attendee, fields);
      const person = {
        lastName: read.lastName ?? "",
        firstName: read.firstName ?? "",
        email: read.email ?? "",
        gender: (request.body.gender as (typeof GUEST_GENDERS)[number] | undefined) ?? read.gender ?? null,
        experience: (request.body.experience as (typeof GUEST_EXPERIENCES)[number] | undefined) ?? read.experience ?? null,
        attendsAfterParty: read.attendsAfterParty ?? false,
        diet: read.diet ?? ("NONE" as const),
        needsAssistance: read.needsAssistance ?? false,
      };
      const preview = { ...person, ticketId: String(attendee.id), ticketRef: attendee.ext_id ?? null, tariff: attendee.ticket ?? null };
      if (!request.body.confirm) return preview;

      if (!person.lastName || !person.firstName || !person.email || !person.gender || !person.experience) {
        return reply.code(422).send({ error: "missing_field", message: "Complétez le genre et l'expérience avant de rattacher ce billet.", preview });
      }
      const [guest] = await addGuests(
        participation,
        [
          {
            ...person,
            gender: person.gender,
            experience: person.experience,
            billetwebTicketId: String(attendee.id),
            billetwebTicketRef: attendee.ext_id ?? null,
            billetwebOrderId: attendee.order_id ?? null,
            billetwebSyncedAt: new Date(),
          },
        ],
        { enforceQuota: false },
      );
      return reply.code(201).send({ id: guest.id });
    },
  );
}
