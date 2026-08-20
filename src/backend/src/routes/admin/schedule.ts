import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateConferences } from "../../lib/revalidate.js";

// Everything on the schedule that is not a talk (#105): welcome, warm-up,
// breaks, lunch, the closing party. The 2026 day is mostly made of these.
//
// An entry does not block its time range. In 2025 lunch ran 12h45–14h15 while
// quickies played at 12h55 and 13h50; in 2026 the quickies moved out and lunch
// is clear. Both have to render, so "is this slot free" is answered by the
// talks on it, never by a flag here.

const KINDS = ["BREAK", "MEAL", "PLENARY", "SOCIAL", "OTHER"] as const;
type ScheduleEntryKind = (typeof KINDS)[number];

interface ScheduleEntryBody {
  editionId: number;
  kind: ScheduleEntryKind;
  labelFr: string;
  labelEn: string;
  startsAt: string;
  endsAt: string;
  roomId?: number | null;
}

/** Returns an error message, or null when the payload is usable. */
function validate(body: Partial<ScheduleEntryBody>): string | null {
  if (body.kind !== undefined && !KINDS.includes(body.kind)) {
    return `Type inconnu. Valeurs acceptées : ${KINDS.join(", ")}.`;
  }
  if (body.labelFr !== undefined && !body.labelFr.trim()) return "Le libellé français est obligatoire.";
  if (body.labelEn !== undefined && !body.labelEn.trim()) return "Le libellé anglais est obligatoire.";

  if (body.startsAt !== undefined && body.endsAt !== undefined) {
    const start = new Date(body.startsAt);
    const end = new Date(body.endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Les horaires sont invalides.";
    // A backwards range would render as a zero-width or negative block, which
    // the grid has no sensible way to draw.
    if (end <= start) return "La fin doit être postérieure au début.";
  }
  return null;
}

export default async function adminScheduleRoutes(app: FastifyInstance) {
  // GET /api/admin/schedule-entries?editionId=X
  app.get<{ Querystring: { editionId?: string } }>("/schedule-entries", async (request) => {
    const { editionId } = request.query;
    return prisma.scheduleEntry.findMany({
      where: editionId ? { editionId: Number(editionId) } : {},
      orderBy: { startsAt: "asc" },
      include: { room: { select: { id: true, name: true } } },
    });
  });

  // POST /api/admin/schedule-entries
  app.post<{ Body: ScheduleEntryBody }>("/schedule-entries", async (request, reply) => {
    const body = request.body;
    const error = validate(body);
    if (error) return reply.code(422).send({ error: "invalid_entry", message: error });

    if (!body.startsAt || !body.endsAt) {
      return reply.code(422).send({ error: "invalid_entry", message: "Les horaires sont obligatoires." });
    }

    const entry = await prisma.scheduleEntry.create({
      data: {
        editionId: body.editionId,
        kind: body.kind,
        labelFr: body.labelFr.trim(),
        labelEn: body.labelEn.trim(),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        roomId: body.roomId ?? null,
      },
      include: { room: { select: { id: true, name: true } } },
    });

    revalidateConferences();
    return reply.code(201).send(entry);
  });

  // PUT /api/admin/schedule-entries/:id
  app.put<{ Params: { id: string }; Body: Partial<ScheduleEntryBody> }>(
    "/schedule-entries/:id",
    async (request, reply) => {
      const id = Number(request.params.id);
      const body = request.body;

      const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "Schedule entry not found" });

      // Validate against the merged result, not the patch alone: sending only
      // `endsAt` must still be checked against the stored `startsAt`.
      const error = validate({
        ...body,
        startsAt: body.startsAt ?? existing.startsAt.toISOString(),
        endsAt: body.endsAt ?? existing.endsAt.toISOString(),
      });
      if (error) return reply.code(422).send({ error: "invalid_entry", message: error });

      const entry = await prisma.scheduleEntry.update({
        where: { id },
        data: {
          ...(body.kind !== undefined && { kind: body.kind }),
          ...(body.labelFr !== undefined && { labelFr: body.labelFr.trim() }),
          ...(body.labelEn !== undefined && { labelEn: body.labelEn.trim() }),
          ...(body.startsAt !== undefined && { startsAt: new Date(body.startsAt) }),
          ...(body.endsAt !== undefined && { endsAt: new Date(body.endsAt) }),
          ...(body.roomId !== undefined && { roomId: body.roomId }),
        },
        include: { room: { select: { id: true, name: true } } },
      });

      revalidateConferences();
      return entry;
    },
  );

  // DELETE /api/admin/schedule-entries/:id
  app.delete<{ Params: { id: string } }>("/schedule-entries/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Schedule entry not found" });

    await prisma.scheduleEntry.delete({ where: { id } });
    revalidateConferences();
    return reply.code(204).send();
  });
}
