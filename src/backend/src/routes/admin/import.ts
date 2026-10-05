import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSpeakers, revalidateConferences } from "../../lib/revalidate.js";
import { importSessionize, loadSessionizeData } from "../../lib/sessionize-import.js";
import { setChannel } from "../../lib/request-context.js";
import { notFound } from "../../lib/admin-helpers.js";

interface SessionizeImportBody {
  editionId: number;
  url?: string;
  json?: string;
}

export default async function adminImportRoutes(app: FastifyInstance) {
  // POST /api/admin/import/sessionize — bulk import speakers + sessions from a
  // Sessionize "All data" export (US-240/US-241, RG-217). Idempotent: matches
  // by slug, so re-running updates instead of duplicating. Accepts either a
  // pasted JSON string or a Sessionize API URL fetched server-side.
  app.post<{ Body: SessionizeImportBody }>("/import/sessionize", async (request, reply) => {
    const { editionId, url, json } = request.body;
    if (!editionId) return reply.code(400).send({ error: "editionId required" });
    if (!url?.trim() && !json?.trim()) {
      return reply.code(400).send({ error: "Provide either `url` or `json`" });
    }

    const edition = await prisma.edition.findUnique({ where: { id: editionId }, select: { id: true } });
    if (!edition) return reply.code(404).send({ error: "Edition not found" });

    let data;
    try {
      data = await loadSessionizeData({ url, json });
    } catch (err) {
      return reply.code(422).send({ error: "Invalid Sessionize data", detail: (err as Error).message });
    }

    // Hundreds of writes in one go: the history should say they came from
    // Sessionize, not from the admin editing each speaker by hand (#513).
    setChannel("IMPORT");
    const report = await importSessionize(editionId, data);

    revalidateSpeakers();
    revalidateConferences();
    return report;
  });

  // GET /api/admin/import/sessionize/:editionId/rooms — the Sessionize rooms
  // seen by the edition's imports, each with the venue room it is paired with,
  // and the venue rooms to choose from (#519).
  app.get<{ Params: { editionId: number } }>("/import/sessionize/:editionId/rooms", {
    schema: { params: { type: "object", required: ["editionId"], properties: { editionId: { type: "integer", minimum: 1 } } } },
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
