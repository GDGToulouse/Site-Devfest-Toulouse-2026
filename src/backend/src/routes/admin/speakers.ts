import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSpeakers } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { generateEditToken } from "../../lib/edit-token.js";
import { sendEditLinkEmail } from "../../lib/edit-link-email.js";

interface SpeakerCreateBody {
  editionId: number;
  name: string;
  photoUrl?: string;
  company?: string;
  city?: string;
  bioFr?: string;
  bioEn?: string;
  socialLinks?: Record<string, string>;
  contactEmail?: string;
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
  // GET /api/admin/speakers?editionId=X — editionId omitted lists all editions
  app.get<{ Querystring: SpeakerListQuery }>("/speakers", {
    schema: { querystring: { type: "object", properties: { editionId: { type: "string" } } } },
  }, async (request) => {
    const { editionId } = request.query;

    const speakers = await prisma.speaker.findMany({
      where: editionId ? { editionId: Number(editionId) } : {},
      include: editionId ? undefined : { edition: { select: { id: true, year: true } } },
      orderBy: editionId ? { name: "asc" } : [{ edition: { year: "desc" } }, { name: "asc" }],
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
        contactEmail: body.contactEmail || null,
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
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail || null }),
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

  // POST /api/admin/speakers/:id/edit-link — (re)generate the token, unlock it,
  // and email the link to the given address (US-221, RG-244, RG-251).
  app.post<{ Params: SpeakerIdParams; Body: { email?: string } }>("/speakers/:id/edit-link", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const speaker = await prisma.speaker.findUnique({ where: { id } });
    if (!speaker) return reply.code(404).send({ error: "Speaker not found" });

    const email = request.body.email?.trim() || speaker.contactEmail;
    if (!email) return reply.code(400).send({ error: "No contact email provided" });

    const token = generateEditToken();
    await prisma.speaker.update({
      where: { id },
      data: { editToken: token, editLinkLocked: false, editTokenSentAt: new Date(), contactEmail: email },
    });

    try {
      await sendEditLinkEmail({ to: email, name: speaker.name, token, kind: "speaker" });
    } catch (err) {
      request.log.error({ err }, "Failed to send speaker edit link email");
      return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
    }
    return { sent: true, email };
  });

  // DELETE /api/admin/speakers/:id/edit-link — revoke (invalidate) the link.
  app.delete<{ Params: SpeakerIdParams }>("/speakers/:id/edit-link", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    const id = Number(request.params.id);
    await prisma.speaker.update({ where: { id }, data: { editToken: null } });
    return { revoked: true };
  });

  // PUT /api/admin/speakers/:id/edit-link/lock — lock/unlock without deleting (RG-245).
  app.put<{ Params: SpeakerIdParams; Body: { locked: boolean } }>("/speakers/:id/edit-link/lock", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    const id = Number(request.params.id);
    const s = await prisma.speaker.update({
      where: { id },
      data: { editLinkLocked: !!request.body.locked },
    });
    return { locked: s.editLinkLocked };
  });
}
