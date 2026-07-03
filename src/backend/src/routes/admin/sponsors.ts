import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateSponsors } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { generateEditToken } from "../../lib/edit-token.js";
import { sendEditLinkEmail } from "../../lib/edit-link-email.js";

const SPONSOR_LEVELS = ["PLATINUM", "GOLD", "SILVER", "SOUTIEN", "COMMUNAUTE"] as const;
type SponsorLevel = (typeof SPONSOR_LEVELS)[number];

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
  publicationStatus?: "DRAFT" | "PUBLISHED";
}

type SponsorUpdateBody = Partial<Omit<SponsorCreateBody, "editionId">>;

interface SponsorIdParams {
  id: string;
}

interface SponsorListQuery {
  editionId?: string;
}

function serialize(s: {
  socialLinks: string | null;
  [k: string]: unknown;
}) {
  return { ...s, socialLinks: s.socialLinks ? JSON.parse(s.socialLinks) : {} };
}

export default async function adminSponsorRoutes(app: FastifyInstance) {
  // GET /api/admin/sponsors?editionId=X
  app.get<{ Querystring: SponsorListQuery }>("/sponsors", {
    schema: {
      querystring: { type: "object", properties: { editionId: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { editionId } = request.query;
    if (!editionId) return reply.code(400).send({ error: "editionId required" });

    const sponsors = await prisma.sponsor.findMany({
      where: { editionId: Number(editionId) },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });
    return sponsors.map(serialize);
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
        publicationStatus: body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
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
        ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
      },
    });

    revalidateSponsors();
    return serialize(sponsor);
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

    const token = generateEditToken();
    await prisma.sponsor.update({
      where: { id },
      data: { editToken: token, editLinkLocked: false, editTokenSentAt: new Date(), contactEmail: email },
    });

    try {
      await sendEditLinkEmail({ to: email, name: sponsor.name, token, kind: "sponsor" });
    } catch (err) {
      request.log.error({ err }, "Failed to send sponsor edit link email");
      return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
    }
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
