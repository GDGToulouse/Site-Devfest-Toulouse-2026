import type { FastifyInstance, FastifyReply } from "fastify";

import { prisma } from "../lib/prisma.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { hasAtLeast, requireSponsorAccess, type SponsorAccess } from "../lib/sponsor-guard.js";
import {
  addGuests,
  guestBodySchema,
  guestData,
  loadGuestBook,
  QuotaExceededError,
  registrationEditionSelect,
  registrationState,
  type GuestBody,
} from "../lib/sponsor-guests.js";
import { guestCsvTemplate, prepareGuestImport, previewGuestImport } from "../lib/sponsor-guest-csv.js";
import { getFeaturedEdition } from "./editions.js";

// A sponsor registers the people it sends to the event (#728), one by one or
// from a CSV (#729), within its places and before the deadline. The rules live
// in lib/sponsor-guests.ts, shared with the back-office.
//
// STAND reads, EDITEUR and above write (RG-INS-22). An ADMIN looking at the
// space for support is the team: neither the deadline nor the quota binds it,
// as in the back-office.

const sponsorIdParams = {
  type: "object",
  required: ["sponsorId"],
  properties: { sponsorId: { type: "string" } },
} as const;

const guestParams = {
  type: "object",
  required: ["sponsorId", "guestId"],
  properties: { sponsorId: { type: "string" }, guestId: { type: "string", pattern: "^[0-9]+$" } },
} as const;

// ~180 KB of CSV once base64-encoded: far above a list of guests, and under
// Fastify's 1 MB body limit.
const IMPORT_MAX_BASE64 = 250_000;

async function loadContext(sponsorId: number) {
  const edition = await getFeaturedEdition();
  if (!edition) return null;
  const [registrationEdition, participation] = await Promise.all([
    prisma.edition.findUniqueOrThrow({ where: { id: edition.id }, select: registrationEditionSelect }),
    prisma.editionSponsor.findFirst({
      where: { sponsorId, editionId: edition.id, edition: notDeleted },
      select: { id: true, editionId: true, tierId: true },
    }),
  ]);
  if (!participation) return null;
  return { participation, registration: registrationState(registrationEdition) };
}

function canWrite(access: SponsorAccess, registration: ReturnType<typeof registrationState>) {
  if (access.isAdminOverride) return true;
  return hasAtLeast(access.accessRole, "EDITEUR") && registration.canSponsorWrite;
}

function refuseClosed(reply: FastifyReply) {
  return reply.code(409).send({
    error: "registration_closed",
    message: "Les inscriptions sont closes : contactez l'équipe du DevFest pour toute modification.",
  });
}

function refuseQuota(reply: FastifyReply, remaining: number) {
  return reply.code(409).send({
    error: "quota_reached",
    remaining,
    message:
      remaining === 0
        ? "Toutes vos places sont prises."
        : `Il ne vous reste que ${remaining} place${remaining > 1 ? "s" : ""}.`,
  });
}

function serializeGuest(g: Awaited<ReturnType<typeof loadGuestBook>>["guests"][number]) {
  return {
    id: g.id,
    lastName: g.lastName,
    firstName: g.firstName,
    email: g.email,
    gender: g.gender,
    experience: g.experience,
    attendsAfterParty: g.attendsAfterParty,
    diet: g.diet,
    needsAssistance: g.needsAssistance,
    rank: g.rank,
    isWithinQuota: g.isWithinQuota,
    hasDuplicateEmail: g.hasDuplicateEmail,
    // A guest with a ticket is read-only here (RG-INS-27).
    hasTicket: g.billetwebTicketId !== null,
    isTicketCancelled: g.isBilletwebCancelled,
  };
}

export default async function sponsorSpaceGuestRoutes(app: FastifyInstance) {
  // GET /api/sponsor-space/:sponsorId/guests — the year's guests and places.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/guests", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("STAND"),
  }, async (request, reply) => {
    const access = request.sponsorAccess!;
    const context = await loadContext(access.sponsorId);
    if (!context) return reply.code(422).send({ error: "no_current_participation" });
    const { registration } = context;

    const registrationPayload = {
      isOpen: registration.isOpen,
      hasEverOpened: registration.hasEverOpened,
      deadline: registration.deadline,
      isPastDeadline: registration.isPastDeadline,
      canWrite: canWrite(access, registration),
    };
    // Never opened: nothing to show yet, the space hides the section (RG-INS-28).
    if (!registration.hasEverOpened && !access.isAdminOverride) {
      return { registration: registrationPayload };
    }

    const book = await loadGuestBook(context.participation.id);
    return {
      registration: registrationPayload,
      quota: book.quota,
      registeredCount: book.registeredCount,
      remaining: book.remaining,
      outOfQuotaCount: book.outOfQuotaCount,
      guests: book.guests.map(serializeGuest),
    };
  });

  // POST /api/sponsor-space/:sponsorId/guests — register one guest.
  app.post<{ Params: { sponsorId: string }; Body: GuestBody }>("/sponsor-space/:sponsorId/guests", {
    schema: { params: sponsorIdParams, body: guestBodySchema },
    preHandler: requireSponsorAccess("EDITEUR"),
  }, async (request, reply) => {
    const access = request.sponsorAccess!;
    const context = await loadContext(access.sponsorId);
    if (!context) return reply.code(422).send({ error: "no_current_participation" });
    if (!canWrite(access, context.registration)) return refuseClosed(reply);

    const parsed = guestData(request.body);
    if ("field" in parsed) return reply.code(400).send({ error: "invalid_field", field: parsed.field });

    try {
      const [guest] = await addGuests(context.participation, [parsed.data], { enforceQuota: !access.isAdminOverride });
      return reply.code(201).send({ id: guest.id });
    } catch (err) {
      if (err instanceof QuotaExceededError) return refuseQuota(reply, err.remaining);
      throw err;
    }
  });

  // PUT /api/sponsor-space/:sponsorId/guests/:guestId — correct a guest, as
  // long as no ticket exists: after that, Billetweb is the reference and the
  // guest corrects it through the link in the ticket e-mail (RG-INS-27).
  app.put<{ Params: { sponsorId: string; guestId: string }; Body: GuestBody }>(
    "/sponsor-space/:sponsorId/guests/:guestId",
    { schema: { params: guestParams, body: guestBodySchema }, preHandler: requireSponsorAccess("EDITEUR") },
    async (request, reply) => {
      const access = request.sponsorAccess!;
      const context = await loadContext(access.sponsorId);
      if (!context) return reply.code(422).send({ error: "no_current_participation" });
      if (!canWrite(access, context.registration)) return refuseClosed(reply);

      const guest = await prisma.sponsorGuest.findFirst({
        where: { id: Number(request.params.guestId), editionSponsorId: context.participation.id },
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

  // DELETE /api/sponsor-space/:sponsorId/guests/:guestId — frees the place.
  // Refused once a ticket exists: cancelling it is the team's call (RG-INS-26).
  app.delete<{ Params: { sponsorId: string; guestId: string } }>(
    "/sponsor-space/:sponsorId/guests/:guestId",
    { schema: { params: guestParams }, preHandler: requireSponsorAccess("EDITEUR") },
    async (request, reply) => {
      const access = request.sponsorAccess!;
      const context = await loadContext(access.sponsorId);
      if (!context) return reply.code(422).send({ error: "no_current_participation" });
      if (!canWrite(access, context.registration)) return refuseClosed(reply);

      const guest = await prisma.sponsorGuest.findFirst({
        where: { id: Number(request.params.guestId), editionSponsorId: context.participation.id },
        select: { id: true, billetwebTicketId: true },
      });
      if (!guest) return reply.code(404).send({ error: "Guest not found" });
      if (guest.billetwebTicketId) return reply.code(409).send({ error: "guest_has_ticket" });

      await prisma.sponsorGuest.delete({ where: { id: guest.id } });
      return reply.code(204).send();
    },
  );

  // GET /api/sponsor-space/:sponsorId/guests/template — the CSV to fill in.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/guests/template", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("EDITEUR"),
  }, async (_request, reply) => {
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="modele-invites-devfest.csv"')
      .send(guestCsvTemplate());
  });

  // POST /api/sponsor-space/:sponsorId/guests/import — reads a CSV (#729).
  // Without `confirm`, a preview that writes nothing (RG-INS-33); with it, the
  // whole batch or nothing. A batch past the remaining places is refused whole
  // (RG-INS-34): importing the first lines only would leave the sponsor to work
  // out which colleagues were dropped.
  app.post<{ Params: { sponsorId: string }; Body: { file: string; confirm?: boolean } }>(
    "/sponsor-space/:sponsorId/guests/import",
    {
      schema: {
        params: sponsorIdParams,
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
      preHandler: requireSponsorAccess("EDITEUR"),
    },
    async (request, reply) => {
      const access = request.sponsorAccess!;
      const context = await loadContext(access.sponsorId);
      if (!context) return reply.code(422).send({ error: "no_current_participation" });
      if (!canWrite(access, context.registration)) return refuseClosed(reply);

      const prepared = prepareGuestImport(Buffer.from(request.body.file, "base64"));
      if (!prepared.ok) return reply.code(422).send(prepared.payload);
      const { rows } = prepared;

      const book = await loadGuestBook(context.participation.id);
      const enforceQuota = !access.isAdminOverride;
      if (!request.body.confirm) {
        return {
          count: rows.length,
          remaining: book.remaining,
          excess: enforceQuota ? Math.max(0, rows.length - book.remaining) : 0,
          guests: previewGuestImport(rows, book.guests.map((g) => g.email)),
        };
      }

      try {
        const created = await addGuests(context.participation, rows.map((r) => r.data), { enforceQuota });
        return reply.code(201).send({ created: created.length });
      } catch (err) {
        if (err instanceof QuotaExceededError) return refuseQuota(reply, err.remaining);
        throw err;
      }
    },
  );
}
