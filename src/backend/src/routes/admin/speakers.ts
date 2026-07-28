import type { FastifyInstance } from "fastify";
import { rotateFeaturedSpeakers } from "../../lib/featured-speakers.js";
import { prisma } from "../../lib/prisma.js";
import { revalidateSpeakers } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { generateEditToken } from "../../lib/edit-token.js";
import { sendEditLinkEmail, normalizeLocale } from "../../lib/edit-link-email.js";
import { notDeleted, notFound, parkUniqueValue, softDeleteData } from "../../lib/admin-helpers.js";

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
  locale?: string;
  isFeatured?: boolean;
  sponsorId?: number | null;
  publicationStatus?: "DRAFT" | "PUBLISHED";
}

// `editionId` no longer moves the speaker (they belong to several editions
// since #351): on an update it says which participation isFeatured and
// publicationStatus apply to.
type SpeakerUpdateBody = Partial<SpeakerCreateBody>;

interface SpeakerIdParams {
  id: string;
}

interface SpeakerListQuery {
  editionId?: string;
}

interface SpeakerBulkBody {
  ids: number[];
  // Which participation to act on (#351) — both actions are per-edition.
  editionId: number;
  action: "setStatus" | "setFeatured";
  value: "DRAFT" | "PUBLISHED" | boolean;
}

// Participations, newest edition first — the admin reads a speaker's history
// from the most recent year backwards.
const withEditions = {
  editions: {
    select: {
      editionId: true,
      isFeatured: true,
      publicationStatus: true,
      edition: { select: { id: true, year: true } },
    },
  },
} as const;

interface SerializableSpeaker {
  socialLinks: string | null;
  editions?: {
    editionId: number;
    isFeatured: boolean;
    publicationStatus: "DRAFT" | "PUBLISHED";
    edition: { id: number; year: number };
  }[];
  [k: string]: unknown;
}

function serialize(s: SerializableSpeaker) {
  return {
    ...s,
    socialLinks: s.socialLinks ? JSON.parse(s.socialLinks) : {},
    ...(s.editions
      ? {
          editions: [...s.editions]
            .sort((a, b) => b.edition.year - a.edition.year)
            .map((e) => ({
              id: e.edition.id,
              year: e.edition.year,
              isFeatured: e.isFeatured,
              publicationStatus: e.publicationStatus,
            })),
        }
      : {}),
  };
}

export default async function adminSpeakerRoutes(app: FastifyInstance) {
  // GET /api/admin/speakers?editionId=X — editionId omitted lists all editions
  app.get<{ Querystring: SpeakerListQuery }>("/speakers", {
    schema: { querystring: { type: "object", properties: { editionId: { type: "string" } } } },
  }, async (request) => {
    const { editionId } = request.query;

    // Filtering goes through the participations since #351. Ordering is
    // alphabetical in both cases: `edition.year` is no longer a to-one relation
    // to sort on, and the admin table sorts client-side anyway.
    const speakers = await prisma.speaker.findMany({
      where: {
        ...notDeleted,
        ...(editionId ? { editions: { some: { editionId: Number(editionId) } } } : {}),
      },
      include: withEditions,
      orderBy: { name: "asc" },
    });
    return speakers.map(serialize);
  });

  // GET /api/admin/speakers/:id
  app.get<{ Params: SpeakerIdParams }>("/speakers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const speaker = await prisma.speaker.findFirst({
      where: { id: Number(request.params.id), ...notDeleted },
      include: withEditions,
    });
    if (!speaker) return reply.code(404).send({ error: "Speaker not found" });
    return serialize(speaker);
  });

  // POST /api/admin/speakers
  app.post<{ Body: SpeakerCreateBody }>("/speakers", async (request, reply) => {
    const body = request.body;
    if (!body.editionId || !body.name?.trim()) {
      return reply.code(400).send({ error: "editionId and name are required" });
    }

    const baseSlug = slugify(body.name);

    // A slug is a person since #351, so an existing one means "this person is
    // already known" — not "derive ada-lovelace-2". Answer 409 with the id so
    // the admin can attach them to this edition instead of forking the identity.
    const live = await prisma.speaker.findFirst({
      where: { slug: baseSlug, ...notDeleted },
      select: { id: true, name: true },
    });
    if (live) {
      return reply.code(409).send({
        error: "Speaker already exists",
        existingSpeakerId: live.id,
        existingSpeakerName: live.name,
      });
    }

    // Deliberately NOT filtered on deletedAt: uniqueness is a database-wide
    // constraint, so a trashed speaker still owns its slug until purged. Parking
    // frees the readable form, but a row keeping an unparked slug (restored, or
    // trashed before #147) must still be counted or the create would collide.
    const existing = await prisma.speaker.findMany({ select: { slug: true } });
    const slug = uniqueSlug(baseSlug, new Set(existing.map((e) => e.slug)));

    const speaker = await prisma.speaker.create({
      data: {
        slug,
        name: body.name.trim(),
        photoUrl: body.photoUrl || null,
        company: body.company || null,
        city: body.city || null,
        bioFr: body.bioFr || null,
        bioEn: body.bioEn || null,
        socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        contactEmail: body.contactEmail || null,
        locale: normalizeLocale(body.locale),
        sponsorId: body.sponsorId ?? null,
        // The editorial state belongs to the participation, not the person.
        editions: {
          create: {
            editionId: body.editionId,
            isFeatured: body.isFeatured ?? false,
            publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
          },
        },
      },
      include: withEditions,
    });

    revalidateSpeakers();
    return reply.code(201).send(serialize(speaker));
  });

  // POST /api/admin/speakers/:id/editions — attach an existing person to an
  // edition (#351). This is what the 409 above points the admin to.
  app.post<{ Params: SpeakerIdParams; Body: { editionId: number; publicationStatus?: "DRAFT" | "PUBLISHED"; isFeatured?: boolean } }>(
    "/speakers/:id/editions",
    { schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
    async (request, reply) => {
      const speakerId = Number(request.params.id);
      const { editionId } = request.body;
      if (!editionId) return reply.code(400).send({ error: "editionId is required" });

      const speaker = await prisma.speaker.findFirst({
        where: { id: speakerId, ...notDeleted },
        select: { id: true },
      });
      if (!speaker) return notFound(reply, "Speaker");

      const edition = await prisma.edition.findFirst({
        where: { id: editionId, ...notDeleted },
        select: { id: true },
      });
      if (!edition) return reply.code(422).send({ error: "Invalid editionId: no such edition" });

      await prisma.speakerEdition.upsert({
        where: { speakerId_editionId: { speakerId, editionId } },
        create: {
          speakerId,
          editionId,
          isFeatured: request.body.isFeatured ?? false,
          publicationStatus: request.body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        },
        update: {
          ...(request.body.isFeatured !== undefined && { isFeatured: request.body.isFeatured }),
          ...(request.body.publicationStatus && { publicationStatus: request.body.publicationStatus }),
        },
      });

      revalidateSpeakers();
      const updated = await prisma.speaker.findUniqueOrThrow({
        where: { id: speakerId },
        include: withEditions,
      });
      return serialize(updated);
    },
  );

  // DELETE /api/admin/speakers/:id/editions/:editionId — detach. Idempotent.
  app.delete<{ Params: { id: string; editionId: string } }>(
    "/speakers/:id/editions/:editionId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "editionId"],
          properties: { id: { type: "string" }, editionId: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      await prisma.speakerEdition.deleteMany({
        where: { speakerId: Number(request.params.id), editionId: Number(request.params.editionId) },
      });
      revalidateSpeakers();
      return reply.code(204).send();
    },
  );

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
        ...(body.locale !== undefined && { locale: normalizeLocale(body.locale) }),
        ...(body.sponsorId !== undefined && { sponsorId: body.sponsorId ?? null }),
      },
    });

    // isFeatured and publicationStatus are per-edition since #351, so they need
    // to say *which* edition. Sent without one, they are ignored rather than
    // silently applied to every year the speaker took part in.
    if (body.editionId && (body.isFeatured !== undefined || body.publicationStatus !== undefined)) {
      await prisma.speakerEdition.updateMany({
        where: { speakerId: Number(id), editionId: body.editionId },
        data: {
          ...(body.isFeatured !== undefined && { isFeatured: body.isFeatured }),
          ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
        },
      });
    }

    revalidateSpeakers();
    const updated = await prisma.speaker.findUniqueOrThrow({
      where: { id: speaker.id },
      include: withEditions,
    });
    return serialize(updated);
  });

  // POST /api/admin/speakers/bulk — apply one action to several speakers at once.
  // POST /api/admin/speakers/rotate-featured — run the nightly rotation now.
  // The scheduled job fires at 1 AM Paris time (#214); this lets an admin
  // trigger it (or test it) without waiting for the small hours.
  app.post("/speakers/rotate-featured", async () => {
    return rotateFeaturedSpeakers();
  });

  app.post<{ Body: SpeakerBulkBody }>("/speakers/bulk", async (request, reply) => {
    const { ids, action, value, editionId } = request.body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      return reply.code(400).send({ error: "ids must be a non-empty array of integers" });
    }
    // Both actions target a participation since #351, so the edition has to be
    // explicit. Applying to every year a speaker took part in would publish
    // people on editions the admin was not even looking at.
    if (!Number.isInteger(editionId)) {
      return reply.code(400).send({ error: "editionId is required" });
    }

    let data: { publicationStatus: "DRAFT" | "PUBLISHED" } | { isFeatured: boolean };
    if (action === "setStatus") {
      if (value !== "DRAFT" && value !== "PUBLISHED") {
        return reply.code(400).send({ error: "value must be DRAFT or PUBLISHED" });
      }
      data = { publicationStatus: value };
    } else if (action === "setFeatured") {
      if (typeof value !== "boolean") {
        return reply.code(400).send({ error: "value must be a boolean" });
      }
      data = { isFeatured: value };
    } else {
      return reply.code(400).send({ error: "unknown action" });
    }

    const { count } = await prisma.speakerEdition.updateMany({
      where: { speakerId: { in: ids }, editionId, speaker: notDeleted },
      data,
    });
    revalidateSpeakers();
    return { count };
  });

  // DELETE /api/admin/speakers/:id — moves the speaker to the trash (#147). The
  // row survives with `deletedAt` set; #145c restores it, #145d purges it.
  app.delete<{ Params: SpeakerIdParams }>("/speakers/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const speakerId = Number(request.params.id);
    const speaker = await prisma.speaker.findFirst({ where: { id: speakerId, ...notDeleted } });
    if (!speaker) return notFound(reply, "Speaker");

    // The slug is unique per edition and a trashed row keeps its slot, so park
    // it out of the live namespace — otherwise re-creating a speaker under the
    // same name would hit the constraint (#146).
    await prisma.speaker.update({
      where: { id: speakerId },
      data: { ...softDeleteData(), slug: parkUniqueValue(speaker.slug, speakerId) },
    });
    revalidateSpeakers();
    return reply.code(204).send();
  });

  // POST /api/admin/speakers/:id/edit-link — (re)generate the token, unlock it,
  // and email the link to the given address (US-221, RG-244, RG-251).
  app.post<{ Params: SpeakerIdParams; Body: { email?: string } }>("/speakers/:id/edit-link", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    // findFirst, not findUnique: a trashed speaker must not get a fresh edit link.
    const speaker = await prisma.speaker.findFirst({ where: { id, ...notDeleted } });
    if (!speaker) return reply.code(404).send({ error: "Speaker not found" });

    const email = request.body.email?.trim() || speaker.contactEmail;
    if (!email) return reply.code(400).send({ error: "No contact email provided" });

    // Send first, persist second (#223): rotating the token before a failed
    // send would break the link the speaker already has, and hand them nothing
    // in return. On SMTP failure the previous link stays valid.
    const token = generateEditToken();
    try {
      await sendEditLinkEmail({
        to: email,
        name: speaker.name,
        token,
        kind: "speaker",
        locale: speaker.locale,
      });
    } catch (err) {
      request.log.error({ err }, "Failed to send speaker edit link email");
      return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
    }

    await prisma.speaker.update({
      where: { id },
      data: { editToken: token, editLinkLocked: false, editTokenSentAt: new Date(), contactEmail: email },
    });
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
