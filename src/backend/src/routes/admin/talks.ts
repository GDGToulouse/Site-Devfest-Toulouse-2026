import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateConferences } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";

const FORMATS = ["CONFERENCE", "QUICKIE", "KEYNOTE"] as const;
type TalkFormat = (typeof FORMATS)[number];
const LEVELS = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"] as const;
type TalkLevel = (typeof LEVELS)[number];

interface TalkCreateBody {
  editionId: number;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  format: TalkFormat;
  level?: TalkLevel | null;
  language: string;
  categoryId?: number | null;
  speakerIds?: number[];
  room?: string;
  publicationStatus?: "DRAFT" | "PUBLISHED";
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

export default async function adminTalkRoutes(app: FastifyInstance) {
  // GET /api/admin/talks?editionId=X — editionId omitted lists all editions
  app.get<{ Querystring: TalkListQuery }>("/talks", {
    schema: { querystring: { type: "object", properties: { editionId: { type: "string" } } } },
  }, async (request) => {
    const { editionId } = request.query;

    const talks = await prisma.talk.findMany({
      where: editionId ? { editionId: Number(editionId) } : {},
      orderBy: editionId ? { titleFr: "asc" } : [{ edition: { year: "desc" } }, { titleFr: "asc" }],
      include: {
        speakers: { select: { id: true, name: true } },
        category: { select: { id: true, nameFr: true, color: true } },
        ...(editionId ? {} : { edition: { select: { id: true, year: true } } }),
      },
    });
    return talks.map(serialize);
  });

  // GET /api/admin/talks/:id
  app.get<{ Params: TalkIdParams }>("/talks/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const talk = await prisma.talk.findUnique({
      where: { id: Number(request.params.id) },
      include: {
        speakers: { select: { id: true, name: true } },
        category: { select: { id: true, nameFr: true, color: true } },
        edition: { select: { id: true, year: true } },
      },
    });
    if (!talk) return reply.code(404).send({ error: "Talk not found" });
    return serialize(talk);
  });

  // POST /api/admin/talks
  app.post<{ Body: TalkCreateBody }>("/talks", async (request, reply) => {
    const body = request.body;
    if (!body.editionId || !body.titleFr?.trim() || !body.titleEn?.trim()) {
      return reply.code(400).send({ error: "editionId, titleFr and titleEn are required" });
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

    const existing = await prisma.talk.findMany({
      where: { editionId: body.editionId },
      select: { slug: true },
    });
    const slug = uniqueSlug(slugify(body.titleFr), new Set(existing.map((e) => e.slug)));

    const talk = await prisma.talk.create({
      data: {
        editionId: body.editionId,
        slug,
        titleFr: body.titleFr.trim(),
        titleEn: body.titleEn.trim(),
        descriptionFr: body.descriptionFr ?? "",
        descriptionEn: body.descriptionEn ?? "",
        format: body.format,
        level: body.level ?? null,
        language: body.language.trim(),
        room: body.room || null,
        categoryId: body.categoryId ?? null,
        publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        ...(body.speakerIds && body.speakerIds.length > 0
          ? { speakers: { connect: body.speakerIds.map((id) => ({ id })) } }
          : {}),
      },
      include: { speakers: { select: { id: true, name: true } } },
    });

    revalidateConferences();
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

    const talk = await prisma.talk.update({
      where: { id: Number(id) },
      data: {
        ...(body.titleFr !== undefined && { titleFr: body.titleFr.trim() }),
        ...(body.titleEn !== undefined && { titleEn: body.titleEn.trim() }),
        ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr }),
        ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn }),
        ...(body.format !== undefined && { format: body.format }),
        ...(body.level !== undefined && { level: body.level ?? null }),
        ...(body.language !== undefined && { language: body.language.trim() }),
        ...(body.room !== undefined && { room: body.room || null }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId ?? null }),
        ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
        ...(body.speakerIds !== undefined && {
          speakers: { set: body.speakerIds.map((sid) => ({ id: sid })) },
        }),
      },
      include: { speakers: { select: { id: true, name: true } } },
    });

    revalidateConferences();
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
      where: { id: { in: ids } },
      data: { publicationStatus: value },
    });
    revalidateConferences();
    return { count };
  });

  // DELETE /api/admin/talks/:id
  app.delete<{ Params: TalkIdParams }>("/talks/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const { id } = request.params;
    await prisma.talk.delete({ where: { id: Number(id) } });
    revalidateConferences();
    return reply.code(204).send();
  });
}
