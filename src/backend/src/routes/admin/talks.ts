import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateConferences, revalidateTalk } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { notDeleted, notFound, parkUniqueValue, softDeleteData } from "../../lib/admin-helpers.js";

const FORMATS = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"] as const;
type TalkFormat = (typeof FORMATS)[number];
const LEVELS = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"] as const;
type TalkLevel = (typeof LEVELS)[number];

interface TalkCreateBody {
  editionId: number;
  title: string;
  description: string;
  format: TalkFormat;
  level?: TalkLevel | null;
  language: string;
  categoryId?: number | null;
  speakerIds?: number[];
  // Scheduling (#105). `roomId: null` unassigns the room; the dates are ISO
  // strings, `null` clears the slot.
  roomId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  isSpeakerEditable?: boolean;
}

type TalkUpdateBody = Partial<Omit<TalkCreateBody, "editionId">>;

interface TalkIdParams {
  id: string;
}

interface TalkListQuery {
  editionId?: string;
}

interface TalkBulkBody {
  ids: number[];
  action: "setStatus";
  value: "DRAFT" | "PUBLISHED";
}

function serialize(t: {
  speakers?: { id: number; name: string }[];
  [k: string]: unknown;
}) {
  return {
    ...t,
    speakerIds: t.speakers?.map((s) => s.id) ?? [],
  };
}

/**
 * Resolve a room assignment for a talk (#105).
 *
 * A room belongs to a venue and a venue hosts editions, so a room is only
 * assignable to a talk whose edition happens at that venue — otherwise a 2026
 * session could be scheduled into a room the DevFest left behind in 2024.
 *
 * Returns the fields to write, or an error message to send back as a 422.
 */
async function resolveRoom(
  roomId: number | null,
  editionId: number,
): Promise<{ data: { roomId: number | null; roomLabel: string | null } } | { error: string }> {
  if (roomId === null) return { data: { roomId: null, roomLabel: null } };

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return { error: "Cette salle n'existe pas." };

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { venueId: true },
  });
  if (!edition || edition.venueId !== room.venueId) {
    return { error: "Cette salle n'appartient pas au lieu de l'édition." };
  }

  // The label is frozen here, not read through at display time (#375).
  return { data: { roomId: room.id, roomLabel: room.name } };
}

export default async function adminTalkRoutes(app: FastifyInstance) {
  // GET /api/admin/talks?editionId=X — editionId omitted lists all editions
  app.get<{ Querystring: TalkListQuery }>("/talks", {
    schema: { querystring: { type: "object", properties: { editionId: { type: "string" } } } },
  }, async (request) => {
    const { editionId } = request.query;

    const talks = await prisma.talk.findMany({
      where: editionId ? { editionId: Number(editionId), ...notDeleted } : notDeleted,
      orderBy: editionId ? { title: "asc" } : [{ edition: { year: "desc" } }, { title: "asc" }],
      include: {
        // Nested reads need their own filter: a query extension would not reach
        // them (Prisma applies those to the top-level operation only), and a
        // trashed speaker would otherwise still show up on a live talk.
        speakers: { where: notDeleted, select: { id: true, name: true } },
        category: { select: { id: true, nameFr: true, color: true } },
        room: { select: { id: true, name: true } },
        ...(editionId ? {} : { edition: { select: { id: true, year: true } } }),
      },
    });
    return talks.map(serialize);
  });

  // GET /api/admin/talks/:id
  app.get<{ Params: TalkIdParams }>("/talks/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const talk = await prisma.talk.findFirst({
      where: { id: Number(request.params.id), ...notDeleted },
      include: {
        speakers: { where: notDeleted, select: { id: true, name: true } },
        category: { select: { id: true, nameFr: true, color: true } },
        room: { select: { id: true, name: true } },
        edition: { select: { id: true, year: true } },
      },
    });
    if (!talk) return reply.code(404).send({ error: "Talk not found" });
    return serialize(talk);
  });

  // POST /api/admin/talks
  app.post<{ Body: TalkCreateBody }>("/talks", async (request, reply) => {
    const body = request.body;
    if (!body.editionId || !body.title?.trim()) {
      return reply.code(400).send({ error: "editionId and title are required" });
    }
    if (!body.format || !FORMATS.includes(body.format)) {
      return reply.code(422).send({ error: `Invalid format. Allowed: ${FORMATS.join(", ")}` });
    }
    if (body.level && !LEVELS.includes(body.level)) {
      return reply.code(422).send({ error: `Invalid level. Allowed: ${LEVELS.join(", ")}` });
    }
    if (!body.language?.trim()) {
      return reply.code(400).send({ error: "language is required" });
    }

    // Deliberately NOT filtered on deletedAt: uniqueness is a database-wide
    // constraint, so a trashed talk still owns its slug until purged. Parking
    // frees the readable form, but a row keeping an unparked slug (restored, or
    // trashed before #147) must still be counted or the create would collide.
    const existing = await prisma.talk.findMany({
      where: { editionId: body.editionId },
      select: { slug: true },
    });
    const slug = uniqueSlug(slugify(body.title), new Set(existing.map((e) => e.slug)));

    const roomAssignment = await resolveRoom(body.roomId ?? null, body.editionId);
    if ("error" in roomAssignment) {
      return reply.code(422).send({ error: "invalid_room", message: roomAssignment.error });
    }

    const talk = await prisma.talk.create({
      data: {
        editionId: body.editionId,
        slug,
        title: body.title.trim(),
        description: body.description ?? "",
        format: body.format,
        level: body.level ?? null,
        language: body.language.trim(),
        ...roomAssignment.data,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        categoryId: body.categoryId ?? null,
        publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        isSpeakerEditable: body.isSpeakerEditable === true,
        ...(body.speakerIds && body.speakerIds.length > 0
          ? { speakers: { connect: body.speakerIds.map((id) => ({ id })) } }
          : {}),
      },
      // The year comes along so the dated URL can be purged too (#360): a talk
      // answers on both /conferences/<slug> and /editions/<year>/conferences/<slug>.
      include: { speakers: { select: { id: true, name: true } }, edition: { select: { year: true } } },
    });

    revalidateConferences();
    revalidateTalk(talk.slug, talk.edition.year);
    return reply.code(201).send(serialize(talk));
  });

  // PUT /api/admin/talks/:id
  app.put<{ Params: TalkIdParams; Body: TalkUpdateBody }>("/talks/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;

    if (body.format !== undefined && !FORMATS.includes(body.format)) {
      return reply.code(422).send({ error: `Invalid format. Allowed: ${FORMATS.join(", ")}` });
    }
    if (body.level && !LEVELS.includes(body.level)) {
      return reply.code(422).send({ error: `Invalid level. Allowed: ${LEVELS.join(", ")}` });
    }

    // The room is validated against the talk's own edition, so the edition has
    // to be read before the update rather than trusted from the request.
    let roomData: { roomId: number | null; roomLabel: string | null } | undefined;
    if (body.roomId !== undefined) {
      const current = await prisma.talk.findUnique({
        where: { id: Number(id) },
        select: { editionId: true },
      });
      if (!current) return reply.code(404).send({ error: "Talk not found" });

      const roomAssignment = await resolveRoom(body.roomId, current.editionId);
      if ("error" in roomAssignment) {
        return reply.code(422).send({ error: "invalid_room", message: roomAssignment.error });
      }
      roomData = roomAssignment.data;
    }

    const talk = await prisma.talk.update({
      where: { id: Number(id) },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.format !== undefined && { format: body.format }),
        ...(body.level !== undefined && { level: body.level ?? null }),
        ...(body.language !== undefined && { language: body.language.trim() }),
        ...(roomData ?? {}),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
        ...(body.endsAt !== undefined && { endsAt: body.endsAt ? new Date(body.endsAt) : null }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId ?? null }),
        ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
        ...(body.isSpeakerEditable !== undefined && { isSpeakerEditable: body.isSpeakerEditable }),
        ...(body.speakerIds !== undefined && {
          speakers: { set: body.speakerIds.map((sid) => ({ id: sid })) },
        }),
      },
      // The year comes along so the dated URL can be purged too (#360): a talk
      // answers on both /conferences/<slug> and /editions/<year>/conferences/<slug>.
      include: { speakers: { select: { id: true, name: true } }, edition: { select: { year: true } } },
    });

    revalidateConferences();
    // No second slug to purge, unlike speakers (#351): a talk's slug is computed
    // once at creation and never recomputed on update.
    revalidateTalk(talk.slug, talk.edition.year);
    return serialize(talk);
  });

  // POST /api/admin/talks/bulk — apply one action to several talks at once.
  app.post<{ Body: TalkBulkBody }>("/talks/bulk", async (request, reply) => {
    const { ids, action, value } = request.body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      return reply.code(400).send({ error: "ids must be a non-empty array of integers" });
    }
    if (action !== "setStatus" || (value !== "DRAFT" && value !== "PUBLISHED")) {
      return reply.code(400).send({ error: "unsupported action or value" });
    }

    const { count } = await prisma.talk.updateMany({
      where: { id: { in: ids }, ...notDeleted },
      data: { publicationStatus: value },
    });
    revalidateConferences();
    return { count };
  });

  // DELETE /api/admin/talks/:id — moves the talk to the trash (#147). The row
  // survives with `deletedAt` set; #145c restores it, #145d purges it for good.
  app.delete<{ Params: TalkIdParams }>("/talks/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const talkId = Number(request.params.id);
    const talk = await prisma.talk.findFirst({
      where: { id: talkId, ...notDeleted },
      include: { edition: { select: { year: true } } },
    });
    if (!talk) return notFound(reply, "Talk");

    // The slug is unique per edition and a trashed row keeps its slot, so park
    // it out of the live namespace — otherwise re-creating a talk under the
    // same title would hit the constraint (#146).
    await prisma.talk.update({
      where: { id: talkId },
      data: { ...softDeleteData(), slug: parkUniqueValue(talk.slug, talkId) },
    });
    revalidateConferences();
    // The slug it had while public — its pages must stop answering from cache.
    revalidateTalk(talk.slug, talk.edition.year);
    return reply.code(204).send();
  });
}
