import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSponsors } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { generateEditToken } from "../../lib/edit-token.js";
import { sendEditLinkEmail, normalizeLocale } from "../../lib/edit-link-email.js";

const SPONSOR_LEVELS = ["PLATINUM", "GOLD", "SILVER", "SOUTIEN", "COMMUNAUTE"] as const;
type SponsorLevel = (typeof SPONSOR_LEVELS)[number];

interface StandContact {
  name?: string;
  linkedin?: string;
  twitter?: string;
  bluesky?: string;
}

interface SponsorCreateBody {
  editionId: number;
  name: string;
  level: SponsorLevel;
  logoUrl?: string;
  websiteUrl?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  socialLinks?: Record<string, string>;
  contactEmail?: string;
  locale?: string;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  // Private fields (#249) — organizers only.
  standContacts?: StandContact[];
  comKitReceived?: boolean;
  comKitLogoWebUrl?: string;
  comKitLogoPrintUrl?: string;
  comKitCharterUrl?: string;
  comKitNotes?: string;
}

type SponsorUpdateBody = Partial<Omit<SponsorCreateBody, "editionId">>;

interface SponsorIdParams {
  id: string;
}

interface SponsorListQuery {
  editionId?: string;
}

interface SponsorBulkBody {
  ids: number[];
  action: "setStatus";
  value: "DRAFT" | "PUBLISHED";
}

function serialize(s: {
  socialLinks: string | null;
  standContacts?: string | null;
  [k: string]: unknown;
}) {
  return {
    ...s,
    socialLinks: s.socialLinks ? JSON.parse(s.socialLinks) : {},
    standContacts: s.standContacts ? JSON.parse(s.standContacts) : [],
  };
}

export default async function adminSponsorRoutes(app: FastifyInstance) {
  // GET /api/admin/sponsors?editionId=X — editionId omitted lists all editions
  app.get<{ Querystring: SponsorListQuery }>("/sponsors", {
    schema: {
      querystring: { type: "object", properties: { editionId: { type: "string" } } },
    },
  }, async (request) => {
    const { editionId } = request.query;

    const sponsors = await prisma.sponsor.findMany({
      where: editionId ? { editionId: Number(editionId) } : {},
      include: editionId ? undefined : { edition: { select: { id: true, year: true } } },
      orderBy: editionId
        ? [{ level: "asc" }, { name: "asc" }]
        : [{ edition: { year: "desc" } }, { level: "asc" }, { name: "asc" }],
    });
    return sponsors.map(serialize);
  });

  // GET /api/admin/sponsors/:id
  app.get<{ Params: SponsorIdParams }>("/sponsors/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const sponsor = await prisma.sponsor.findUnique({
      where: { id: Number(request.params.id) },
      include: { edition: { select: { id: true, year: true } } },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });
    return serialize(sponsor);
  });

  // POST /api/admin/sponsors
  app.post<{ Body: SponsorCreateBody }>("/sponsors", async (request, reply) => {
    const body = request.body;

    if (!body.editionId || !body.name?.trim() || !body.level) {
      return reply.code(400).send({ error: "editionId, name and level are required" });
    }
    if (!SPONSOR_LEVELS.includes(body.level)) {
      return reply.code(422).send({ error: `Invalid level. Allowed: ${SPONSOR_LEVELS.join(", ")}` });
    }

    // Build a slug unique within the edition.
    const existing = await prisma.sponsor.findMany({
      where: { editionId: body.editionId },
      select: { slug: true },
    });
    const slug = uniqueSlug(slugify(body.name), new Set(existing.map((e) => e.slug)));

    const sponsor = await prisma.sponsor.create({
      data: {
        editionId: body.editionId,
        slug,
        name: body.name.trim(),
        level: body.level,
        logoUrl: body.logoUrl || null,
        websiteUrl: body.websiteUrl || null,
        descriptionFr: body.descriptionFr || null,
        descriptionEn: body.descriptionEn || null,
        socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        contactEmail: body.contactEmail || null,
        locale: normalizeLocale(body.locale),
        publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        // Private fields (#249).
        standContacts: body.standContacts?.length ? JSON.stringify(body.standContacts) : null,
        comKitReceived: body.comKitReceived ?? false,
        comKitLogoWebUrl: body.comKitLogoWebUrl || null,
        comKitLogoPrintUrl: body.comKitLogoPrintUrl || null,
        comKitCharterUrl: body.comKitCharterUrl || null,
        comKitNotes: body.comKitNotes || null,
      },
    });

    revalidateSponsors();
    return reply.code(201).send(serialize(sponsor));
  });

  // PUT /api/admin/sponsors/:id
  app.put<{ Params: SponsorIdParams; Body: SponsorUpdateBody }>("/sponsors/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;

    if (body.level !== undefined && !SPONSOR_LEVELS.includes(body.level)) {
      return reply.code(422).send({ error: `Invalid level. Allowed: ${SPONSOR_LEVELS.join(", ")}` });
    }

    const sponsor = await prisma.sponsor.update({
      where: { id: Number(id) },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.level !== undefined && { level: body.level }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
        ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl || null }),
        ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr || null }),
        ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn || null }),
        ...(body.socialLinks !== undefined && {
          socialLinks: body.socialLinks ? JSON.stringify(body.socialLinks) : null,
        }),
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail || null }),
        ...(body.locale !== undefined && { locale: normalizeLocale(body.locale) }),
        ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
        // Private fields (#249).
        ...(body.standContacts !== undefined && {
          standContacts: body.standContacts?.length ? JSON.stringify(body.standContacts) : null,
        }),
        ...(body.comKitReceived !== undefined && { comKitReceived: body.comKitReceived }),
        ...(body.comKitLogoWebUrl !== undefined && { comKitLogoWebUrl: body.comKitLogoWebUrl || null }),
        ...(body.comKitLogoPrintUrl !== undefined && { comKitLogoPrintUrl: body.comKitLogoPrintUrl || null }),
        ...(body.comKitCharterUrl !== undefined && { comKitCharterUrl: body.comKitCharterUrl || null }),
        ...(body.comKitNotes !== undefined && { comKitNotes: body.comKitNotes || null }),
      },
    });

    revalidateSponsors();
    return serialize(sponsor);
  });

  // POST /api/admin/sponsors/bulk — apply one action to several sponsors at once.
  app.post<{ Body: SponsorBulkBody }>("/sponsors/bulk", async (request, reply) => {
    const { ids, action, value } = request.body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      return reply.code(400).send({ error: "ids must be a non-empty array of integers" });
    }
    if (action !== "setStatus" || (value !== "DRAFT" && value !== "PUBLISHED")) {
      return reply.code(400).send({ error: "unsupported action or value" });
    }

    const { count } = await prisma.sponsor.updateMany({
      where: { id: { in: ids } },
      data: { publicationStatus: value },
    });
    revalidateSponsors();
    return { count };
  });

  // DELETE /api/admin/sponsors/:id
  app.delete<{ Params: SponsorIdParams }>("/sponsors/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    await prisma.sponsor.delete({ where: { id: Number(id) } });
    revalidateSponsors();
    return reply.code(204).send();
  });

  // POST /api/admin/sponsors/:id/edit-link — (re)generate token + email it.
  app.post<{ Params: SponsorIdParams; Body: { email?: string } }>("/sponsors/:id/edit-link", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

    const email = request.body.email?.trim() || sponsor.contactEmail;
    if (!email) return reply.code(400).send({ error: "No contact email provided" });

    // Send first, persist second (#223): rotating the token before a failed
    // send would break the link the sponsor already has, and hand them nothing
    // in return. On SMTP failure the previous link stays valid.
    const token = generateEditToken();
    try {
      await sendEditLinkEmail({
        to: email,
        name: sponsor.name,
        token,
        kind: "sponsor",
        locale: sponsor.locale,
      });
    } catch (err) {
      request.log.error({ err }, "Failed to send sponsor edit link email");
      return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
    }

    await prisma.sponsor.update({
      where: { id },
      data: { editToken: token, editLinkLocked: false, editTokenSentAt: new Date(), contactEmail: email },
    });
    return { sent: true, email };
  });

  // DELETE /api/admin/sponsors/:id/edit-link — revoke the link.
  app.delete<{ Params: SponsorIdParams }>("/sponsors/:id/edit-link", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    await prisma.sponsor.update({ where: { id: Number(request.params.id) }, data: { editToken: null } });
    return { revoked: true };
  });

  // PUT /api/admin/sponsors/:id/edit-link/lock — lock/unlock without deleting.
  app.put<{ Params: SponsorIdParams; Body: { locked: boolean } }>("/sponsors/:id/edit-link/lock", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    const s = await prisma.sponsor.update({
      where: { id: Number(request.params.id) },
      data: { editLinkLocked: !!request.body.locked },
    });
    return { locked: s.editLinkLocked };
  });
}
