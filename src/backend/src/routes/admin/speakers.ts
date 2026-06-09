import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSpeakers } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";

interface SpeakerCreateBody {
  editionId: number;
  name: string;
  photoUrl?: string;
  company?: string;
  city?: string;
  bioFr?: string;
  bioEn?: string;
  socialLinks?: Record<string, string>;
  isFeatured?: boolean;
  sponsorId?: number | null;
  publicationStatus?: "DRAFT" | "PUBLISHED";
}

type SpeakerUpdateBody = Partial<Omit<SpeakerCreateBody, "editionId">>;

interface SpeakerIdParams {
  id: string;
}

interface SpeakerListQuery {
  editionId?: string;
}

function serialize(s: { socialLinks: string | null; [k: string]: unknown }) {
  return { ...s, socialLinks: s.socialLinks ? JSON.parse(s.socialLinks) : {} };
}

export default async function adminSpeakerRoutes(app: FastifyInstance) {
  // GET /api/admin/speakers?editionId=X
  app.get<{ Querystring: SpeakerListQuery }>("/speakers", {
    schema: { querystring: { type: "object", properties: { editionId: { type: "string" } } } },
  }, async (request, reply) => {
    const { editionId } = request.query;
    if (!editionId) return reply.code(400).send({ error: "editionId required" });

    const speakers = await prisma.speaker.findMany({
      where: { editionId: Number(editionId) },
      orderBy: { name: "asc" },
    });
    return speakers.map(serialize);
  });

  // POST /api/admin/speakers
  app.post<{ Body: SpeakerCreateBody }>("/speakers", async (request, reply) => {
    const body = request.body;
    if (!body.editionId || !body.name?.trim()) {
      return reply.code(400).send({ error: "editionId and name are required" });
    }

    const existing = await prisma.speaker.findMany({
      where: { editionId: body.editionId },
      select: { slug: true },
    });
    const slug = uniqueSlug(slugify(body.name), new Set(existing.map((e) => e.slug)));

    const speaker = await prisma.speaker.create({
      data: {
        editionId: body.editionId,
        slug,
        name: body.name.trim(),
        photoUrl: body.photoUrl || null,
        company: body.company || null,
        city: body.city || null,
        bioFr: body.bioFr || null,
        bioEn: body.bioEn || null,
        socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        isFeatured: body.isFeatured ?? false,
        sponsorId: body.sponsorId ?? null,
        publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      },
    });

    revalidateSpeakers();
    return reply.code(201).send(serialize(speaker));
  });

  // PUT /api/admin/speakers/:id
  app.put<{ Params: SpeakerIdParams; Body: SpeakerUpdateBody }>("/speakers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    const { id } = request.params;
    const body = request.body;

    const speaker = await prisma.speaker.update({
      where: { id: Number(id) },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl || null }),
        ...(body.company !== undefined && { company: body.company || null }),
        ...(body.city !== undefined && { city: body.city || null }),
        ...(body.bioFr !== undefined && { bioFr: body.bioFr || null }),
        ...(body.bioEn !== undefined && { bioEn: body.bioEn || null }),
        ...(body.socialLinks !== undefined && {
          socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        }),
        ...(body.isFeatured !== undefined && { isFeatured: body.isFeatured }),
        ...(body.sponsorId !== undefined && { sponsorId: body.sponsorId ?? null }),
        ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
      },
    });

    revalidateSpeakers();
    return serialize(speaker);
  });

  // DELETE /api/admin/speakers/:id
  app.delete<{ Params: SpeakerIdParams }>("/speakers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const { id } = request.params;
    await prisma.speaker.delete({ where: { id: Number(id) } });
    revalidateSpeakers();
    return reply.code(204).send();
  });
}
