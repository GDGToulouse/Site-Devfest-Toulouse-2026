import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateVenue } from "../../lib/revalidate.js";
import { sanitizeRichHtml, isSafeUrl } from "../../lib/sanitize.js";

// CRUD for venues and their rooms (#105). A venue is shared across editions —
// the DevFest returns to the same congress centre for years at a time — so its
// details are edited here rather than on each edition.
//
// Neither venues nor rooms go to the trash (#146). They are configuration in
// very small numbers, and a room that vanished quietly from a published grid
// would be worse than a delete that refuses with a reason.

interface VenueBody {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  transports?: string | null;
  parking?: string | null;
  directionsUrl?: string | null;
}

interface RoomBody {
  name: string;
  capacity?: number | null;
  sortOrder?: number;
}

/** Shared by create and update: the checks that protect the public page. */
function validateVenue(body: Partial<VenueBody>): string | null {
  if (body.name !== undefined && !body.name.trim()) {
    return "Le nom du lieu est obligatoire.";
  }
  // The directions URL lands in an href on /lieu, so a javascript:/data: scheme
  // is refused at the source rather than stored as an XSS vector (#109). Same
  // allowlist as sponsor and social URLs (#223).
  if (body.directionsUrl && !isSafeUrl(body.directionsUrl)) {
    return "Le lien itinéraire doit être une URL http(s) valide.";
  }
  return null;
}

function venueWriteData(body: Partial<VenueBody>) {
  return {
    ...(body.name !== undefined && { name: body.name.trim() }),
    ...(body.address !== undefined && { address: body.address || null }),
    ...(body.lat !== undefined && { lat: body.lat }),
    ...(body.lng !== undefined && { lng: body.lng }),
    // Rich text, sanitized on write like sponsor descriptions.
    ...(body.transports !== undefined && { transports: sanitizeRichHtml(body.transports) || null }),
    ...(body.parking !== undefined && { parking: sanitizeRichHtml(body.parking) || null }),
    ...(body.directionsUrl !== undefined && { directionsUrl: body.directionsUrl || null }),
  };
}

export default async function adminVenueRoutes(app: FastifyInstance) {
  // GET /api/admin/venues — the whole list, with rooms in grid order.
  app.get("/venues", async () => {
    return prisma.venue.findMany({
      orderBy: { name: "asc" },
      include: {
        rooms: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        _count: { select: { editions: true } },
      },
    });
  });

  // GET /api/admin/venues/:id
  app.get<{ Params: { id: string } }>("/venues/:id", async (request, reply) => {
    const venue = await prisma.venue.findUnique({
      where: { id: Number(request.params.id) },
      include: {
        rooms: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        editions: { select: { id: true, year: true }, orderBy: { year: "desc" } },
      },
    });
    if (!venue) return reply.code(404).send({ error: "Venue not found" });
    return venue;
  });

  // POST /api/admin/venues
  app.post<{ Body: VenueBody }>("/venues", async (request, reply) => {
    const error = validateVenue(request.body);
    if (error) return reply.code(422).send({ error: "invalid_venue", message: error });

    const existing = await prisma.venue.findUnique({ where: { name: request.body.name.trim() } });
    if (existing) {
      return reply.code(409).send({
        error: "duplicate_venue",
        message: "Un lieu porte déjà ce nom.",
        venueId: existing.id,
      });
    }

    const venue = await prisma.venue.create({
      data: { name: request.body.name.trim(), ...venueWriteData(request.body) },
    });
    return reply.code(201).send(venue);
  });

  // PUT /api/admin/venues/:id
  app.put<{ Params: { id: string }; Body: Partial<VenueBody> }>("/venues/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const error = validateVenue(request.body);
    if (error) return reply.code(422).send({ error: "invalid_venue", message: error });

    const venue = await prisma.venue.findUnique({ where: { id } });
    if (!venue) return reply.code(404).send({ error: "Venue not found" });

    const updated = await prisma.venue.update({ where: { id }, data: venueWriteData(request.body) });
    // The venue drives the public /lieu page and the homepage strap line.
    revalidateVenue();
    return updated;
  });

  // DELETE /api/admin/venues/:id — refused while an edition still points here.
  app.delete<{ Params: { id: string } }>("/venues/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: { editions: { select: { year: true }, orderBy: { year: "desc" } } },
    });
    if (!venue) return reply.code(404).send({ error: "Venue not found" });

    if (venue.editions.length > 0) {
      const years = venue.editions.map((e) => e.year).join(", ");
      return reply.code(409).send({
        error: "venue_in_use",
        message: `Ce lieu accueille encore ${venue.editions.length > 1 ? "les éditions" : "l'édition"} ${years}. Rattachez-les ailleurs avant de le supprimer.`,
      });
    }

    await prisma.venue.delete({ where: { id } });
    return reply.code(204).send();
  });

  // --- Rooms ------------------------------------------------------------

  // POST /api/admin/venues/:id/rooms
  app.post<{ Params: { id: string }; Body: RoomBody }>("/venues/:id/rooms", async (request, reply) => {
    const venueId = Number(request.params.id);
    const { name, capacity, sortOrder } = request.body;

    if (!name?.trim()) {
      return reply.code(422).send({ error: "invalid_room", message: "Le nom de la salle est obligatoire." });
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return reply.code(404).send({ error: "Venue not found" });

    const existing = await prisma.room.findUnique({
      where: { venueId_name: { venueId, name: name.trim() } },
    });
    if (existing) {
      return reply.code(409).send({
        error: "duplicate_room",
        message: "Ce lieu a déjà une salle de ce nom.",
      });
    }

    const room = await prisma.room.create({
      data: { venueId, name: name.trim(), capacity: capacity ?? null, sortOrder: sortOrder ?? 0 },
    });
    return reply.code(201).send(room);
  });

  // PUT /api/admin/rooms/:id
  app.put<{ Params: { id: string }; Body: Partial<RoomBody> }>("/rooms/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const { name, capacity, sortOrder } = request.body;

    if (name !== undefined && !name.trim()) {
      return reply.code(422).send({ error: "invalid_room", message: "Le nom de la salle est obligatoire." });
    }

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return reply.code(404).send({ error: "Room not found" });

    // Renaming a room does NOT rewrite the talks already scheduled in it: they
    // carry their own frozen label (#375), so a 2026 grid keeps saying what the
    // signage said in 2026.
    const updated = await prisma.room.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(capacity !== undefined && { capacity }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    return updated;
  });

  // DELETE /api/admin/rooms/:id — refused while a talk is scheduled in it.
  app.delete<{ Params: { id: string } }>("/rooms/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const room = await prisma.room.findUnique({
      where: { id },
      include: { _count: { select: { talks: true } } },
    });
    if (!room) return reply.code(404).send({ error: "Room not found" });

    if (room._count.talks > 0) {
      return reply.code(409).send({
        error: "room_in_use",
        message:
          room._count.talks > 1
            ? `${room._count.talks} conférences sont programmées dans cette salle. Déplacez-les avant de la supprimer.`
            : "Une conférence est programmée dans cette salle. Déplacez-la avant de supprimer la salle.",
      });
    }

    await prisma.room.delete({ where: { id } });
    return reply.code(204).send();
  });
}
