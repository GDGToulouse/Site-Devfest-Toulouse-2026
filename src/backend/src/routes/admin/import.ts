import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSpeakers, revalidateConferences } from "../../lib/revalidate.js";
import { importSessionize, loadSessionizeData } from "../../lib/sessionize-import.js";
import { loadServiceSlots, type SzServiceSlot } from "../../lib/sessionize-service-slots.js";
import { setChannel } from "../../lib/request-context.js";
import { notFound } from "../../lib/admin-helpers.js";
import { requireAdminRole } from "../../lib/admin-guard.js";

interface SessionizeImportBody {
  editionId: number;
  url?: string;
  json?: string;
}

const editionIdParams = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "integer", minimum: 1 } },
} as const;

export default async function adminImportRoutes(app: FastifyInstance) {
  // POST /api/admin/import/sessionize — bulk import speakers + sessions from a
  // Sessionize "All data" export (US-240/US-241, RG-217). Idempotent: matches
  // by slug, so re-running updates instead of duplicating. Accepts either a
  // pasted JSON string or a Sessionize API URL fetched server-side. With
  // neither, it re-imports from the link the edition kept (#529).
  app.post<{ Body: SessionizeImportBody }>("/import/sessionize", {
    schema: {
      body: {
        type: "object",
        required: ["editionId"],
        properties: {
          editionId: { type: "integer", minimum: 1 },
          url: { type: "string", format: "uri", maxLength: 2048 },
          // A whole edition's export: generous, but bounded.
          json: { type: "string", maxLength: 20_000_000 },
        },
      },
    },
  }, async (request, reply) => {
    const { editionId, json } = request.body;
    const givenUrl = request.body.url?.trim() || undefined;

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, sessionizeApiUrl: true },
    });
    if (!edition) return reply.code(404).send({ error: "Edition not found" });

    // The saved link goes through loadSessionizeData's SSRF guard like a typed
    // one: a value read back from the database is still user input (#306).
    const url = json?.trim() ? undefined : givenUrl ?? edition.sessionizeApiUrl ?? undefined;
    if (!url && !json?.trim()) {
      return reply.code(400).send({
        error: "no_source",
        message: "Aucun lien Sessionize enregistré pour cette édition.",
      });
    }

    let data;
    try {
      data = await loadSessionizeData({ url, json });
    } catch (err) {
      return reply.code(422).send({ error: "Invalid Sessionize data", detail: (err as Error).message });
    }

    // The service sessions only exist in the GridSmart view, fetched next to
    // the one given (#546). A pasted export has no URL to derive it from, and a
    // failed fetch leaves the schedule entries as they are rather than failing
    // the whole import.
    let serviceSlots: SzServiceSlot[] | null = null;
    let slotsWarning: string | null = null;
    if (url) {
      try {
        serviceSlots = await loadServiceSlots(url);
      } catch (err) {
        slotsWarning = `Créneaux hors session non importés : ${(err as Error).message}`;
      }
    } else {
      slotsWarning = "Créneaux hors session non importés : ils ne se lisent que depuis le lien de l'API Sessionize, pas depuis un export collé.";
    }

    // Hundreds of writes in one go: the history should say they came from
    // Sessionize, not from the admin editing each speaker by hand (#513).
    setChannel("IMPORT");
    const report = await importSessionize(editionId, data, serviceSlots);
    if (slotsWarning) report.warnings.push(slotsWarning);

    // Kept only once a link has worked: an URL that failed is never saved, and
    // a pasted export leaves the saved link alone (#529).
    if (givenUrl && givenUrl !== edition.sessionizeApiUrl) {
      await prisma.edition.update({ where: { id: editionId }, data: { sessionizeApiUrl: givenUrl } });
    }

    revalidateSpeakers();
    revalidateConferences();
    return report;
  });

  // GET /api/admin/import/sessionize/:editionId/source — the link the edition
  // kept from its last successful import, or null (#529).
  app.get<{ Params: { editionId: number } }>("/import/sessionize/:editionId/source", {
    schema: { params: editionIdParams },
  }, async (request, reply) => {
    const edition = await prisma.edition.findUnique({
      where: { id: request.params.editionId },
      select: { sessionizeApiUrl: true },
    });
    if (!edition) return notFound(reply, "Edition");
    return { url: edition.sessionizeApiUrl };
  });

  // DELETE /api/admin/import/sessionize/:editionId/source — forget the link.
  // What it imported stays. ADMIN-only (decision of 2026-10-06): editors
  // re-import with the link the team shares, they do not drop it.
  app.delete<{ Params: { editionId: number } }>("/import/sessionize/:editionId/source", {
    preHandler: [requireAdminRole],
    schema: { params: editionIdParams },
  }, async (request, reply) => {
    const edition = await prisma.edition.findUnique({ where: { id: request.params.editionId }, select: { id: true } });
    if (!edition) return notFound(reply, "Edition");
    await prisma.edition.update({ where: { id: edition.id }, data: { sessionizeApiUrl: null } });
    return reply.code(204).send();
  });

  // GET /api/admin/import/sessionize/:editionId/rooms — the Sessionize rooms
  // seen by the edition's imports, each with the venue room it is paired with,
  // and the venue rooms to choose from (#519).
  app.get<{ Params: { editionId: number } }>("/import/sessionize/:editionId/rooms", {
    schema: { params: editionIdParams },
  }, async (request, reply) => {
    const edition = await prisma.edition.findUnique({
      where: { id: request.params.editionId },
      select: {
        venue: {
          select: { id: true, name: true, rooms: { select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
        },
        sessionizeRooms: { select: { sessionizeId: true, name: true, roomId: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!edition) return notFound(reply, "Edition");
    return {
      venue: edition.venue ? { id: edition.venue.id, name: edition.venue.name } : null,
      venueRooms: edition.venue?.rooms ?? [],
      pairings: edition.sessionizeRooms,
    };
  });

  // PUT /api/admin/import/sessionize/:editionId/rooms/:sessionizeId — pair a
  // Sessionize room with a venue room, or unpair it with null. Talks already
  // imported keep their room until the next import applies the pairing.
  app.put<{ Params: { editionId: number; sessionizeId: number }; Body: { roomId: number | null } }>(
    "/import/sessionize/:editionId/rooms/:sessionizeId",
    {
      schema: {
        params: {
          type: "object",
          required: ["editionId", "sessionizeId"],
          properties: { editionId: { type: "integer", minimum: 1 }, sessionizeId: { type: "integer" } },
        },
        body: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: { roomId: { type: ["integer", "null"], minimum: 1 } },
        },
      },
    },
    async (request, reply) => {
      const { editionId, sessionizeId } = request.params;
      const { roomId } = request.body;
      const pairing = await prisma.sessionizeRoom.findUnique({
        where: { editionId_sessionizeId: { editionId, sessionizeId } },
        select: { id: true, edition: { select: { venueId: true } } },
      });
      if (!pairing) return notFound(reply, "Sessionize room");

      if (roomId !== null) {
        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { venueId: true } });
        if (!room || room.venueId !== pairing.edition.venueId) {
          return reply.code(422).send({ error: "Invalid room", message: "Cette salle n'appartient pas au lieu de l'édition." });
        }
      }

      const updated = await prisma.sessionizeRoom.update({
        where: { id: pairing.id },
        data: { roomId },
        select: { sessionizeId: true, name: true, roomId: true },
      });
      return updated;
    },
  );
}
