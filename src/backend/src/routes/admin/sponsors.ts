import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateJobOffers, revalidateSponsor, revalidateSponsors } from "../../lib/revalidate.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { generateEditToken } from "../../lib/edit-token.js";
import { sendEditLinkEmail, normalizeLocale } from "../../lib/edit-link-email.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import { notDeleted, notFound, parkUniqueValue, softDeleteData } from "../../lib/admin-helpers.js";

interface StandContact {
  name?: string;
  linkedin?: string;
  twitter?: string;
  bluesky?: string;
}

interface SponsorCreateBody {
  editionId: number;
  name: string;
  tierId: number;
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
  platinumPromoIdea?: string;
  platinumCoBuildIdea?: string;
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
      where: editionId ? { editionId: Number(editionId), ...notDeleted } : notDeleted,
      include: {
        tier: { select: { key: true, nameFr: true, nameEn: true, rank: true } },
        ...(editionId ? {} : { edition: { select: { id: true, year: true } } }),
      },
      // Higher tier rank first (RG-221), then name.
      orderBy: editionId
        ? [{ tier: { rank: "desc" } }, { name: "asc" }]
        : [{ edition: { year: "desc" } }, { tier: { rank: "desc" } }, { name: "asc" }],
    });
    return sponsors.map(serialize);
  });

  // GET /api/admin/sponsors/:id
  app.get<{ Params: SponsorIdParams }>("/sponsors/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request, reply) => {
    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const sponsor = await prisma.sponsor.findFirst({
      where: { id: Number(request.params.id), ...notDeleted },
      include: {
        edition: { select: { id: true, year: true } },
        tier: { select: { key: true, nameFr: true, nameEn: true, rank: true } },
        // Job offers for admin consultation/moderation (#251).
        jobOffers: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });
    return serialize(sponsor);
  });

  // POST /api/admin/sponsors
  app.post<{ Body: SponsorCreateBody }>("/sponsors", async (request, reply) => {
    const body = request.body;

    if (!body.editionId || !body.name?.trim() || !body.tierId) {
      return reply.code(400).send({ error: "editionId, name and tierId are required" });
    }
    const tier = await prisma.sponsorTier.findFirst({
      where: { id: body.tierId, ...notDeleted },
      select: { id: true },
    });
    if (!tier) {
      return reply.code(422).send({ error: "Invalid tierId: no such sponsor tier" });
    }

    // Build a slug unique within the edition. Deliberately NOT filtered on
    // deletedAt: uniqueness is a database-wide constraint, so a trashed sponsor
    // still owns its slug until purged. Parking frees the readable form, but a
    // row keeping an unparked slug (restored, or trashed before #147) must still
    // be counted or the create would collide.
    const existing = await prisma.sponsor.findMany({
      where: { editionId: body.editionId },
      select: { slug: true },
    });
    const slug = uniqueSlug(slugify(body.name), new Set(existing.map((e) => e.slug)));

    const sponsor = await prisma.sponsor.create({
      include: { tier: { select: { key: true, nameFr: true, nameEn: true, rank: true } } },
      data: {
        editionId: body.editionId,
        slug,
        name: body.name.trim(),
        tierId: body.tierId,
        logoUrl: body.logoUrl || null,
        websiteUrl: body.websiteUrl || null,
        // Rich-text HTML (#270): sanitized on write, like article content.
        descriptionFr: sanitizeRichHtml(body.descriptionFr) || null,
        descriptionEn: sanitizeRichHtml(body.descriptionEn) || null,
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
        platinumPromoIdea: body.platinumPromoIdea || null,
        platinumCoBuildIdea: body.platinumCoBuildIdea || null,
      },
    });

    revalidateSponsors();
    revalidateSponsor(sponsor.slug);
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

    if (body.tierId !== undefined) {
      const tier = await prisma.sponsorTier.findFirst({
        where: { id: body.tierId, ...notDeleted },
        select: { id: true },
      });
      if (!tier) {
        return reply.code(422).send({ error: "Invalid tierId: no such sponsor tier" });
      }
    }

    const sponsor = await prisma.sponsor.update({
      where: { id: Number(id) },
      include: { tier: { select: { key: true, nameFr: true, nameEn: true, rank: true } } },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.tierId !== undefined && { tierId: body.tierId }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
        ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl || null }),
        // Rich-text HTML (#270): sanitized on write, like article content.
        ...(body.descriptionFr !== undefined && { descriptionFr: sanitizeRichHtml(body.descriptionFr) || null }),
        ...(body.descriptionEn !== undefined && { descriptionEn: sanitizeRichHtml(body.descriptionEn) || null }),
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
        ...(body.platinumPromoIdea !== undefined && { platinumPromoIdea: body.platinumPromoIdea || null }),
        ...(body.platinumCoBuildIdea !== undefined && { platinumCoBuildIdea: body.platinumCoBuildIdea || null }),
      },
    });

    revalidateSponsors();
    // No second slug to purge here, unlike speakers (#351): a sponsor's slug is
    // computed once at creation and never recomputed on update.
    revalidateSponsor(sponsor.slug);
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
      where: { id: { in: ids }, ...notDeleted },
      data: { publicationStatus: value },
    });
    revalidateSponsors();
    return { count };
  });

  // DELETE /api/admin/sponsors/:id — moves the sponsor to the trash (#147). The
  // row survives with `deletedAt` set; #145c restores it, #145d purges it.
  app.delete<{ Params: SponsorIdParams }>("/sponsors/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
  }, async (request, reply) => {
    const sponsorId = Number(request.params.id);
    const sponsor = await prisma.sponsor.findFirst({ where: { id: sponsorId, ...notDeleted } });
    if (!sponsor) return notFound(reply, "Sponsor");

    // The slug is unique per edition and a trashed row keeps its slot, so park
    // it out of the live namespace — otherwise re-creating a sponsor under the
    // same name would hit the constraint (#146).
    await prisma.sponsor.update({
      where: { id: sponsorId },
      data: { ...softDeleteData(), slug: parkUniqueValue(sponsor.slug, sponsorId) },
    });
    revalidateSponsors();
    // The slug it had while public — the parked one was never served, and its
    // page has to stop answering from cache now that the row is trashed.
    revalidateSponsor(sponsor.slug);
    return reply.code(204).send();
  });

  // A sponsor can have several contacts, each with its own modification link
  // (#250). The token itself is never returned to the admin — only whether a
  // link is active, when it was sent, and if it's locked.
  const serializeContact = (c: {
    id: number;
    email: string;
    name: string | null;
    role: string | null;
    editToken: string | null;
    editLinkLocked: boolean;
    editTokenSentAt: Date | null;
  }) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    role: c.role,
    hasLink: !!c.editToken,
    editLinkLocked: c.editLinkLocked,
    editTokenSentAt: c.editTokenSentAt,
  });

  // GET /api/admin/sponsors/:id/contacts — list a sponsor's contacts.
  app.get<{ Params: SponsorIdParams }>("/sponsors/:id/contacts", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  }, async (request) => {
    const contacts = await prisma.sponsorContact.findMany({
      where: { sponsorId: Number(request.params.id) },
      orderBy: { createdAt: "asc" },
    });
    return contacts.map(serializeContact);
  });

  // POST /api/admin/sponsors/:id/contacts — add a contact and send its link.
  app.post<{ Params: SponsorIdParams; Body: { email?: string; name?: string; role?: string } }>(
    "/sponsors/:id/contacts",
    { schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } },
    async (request, reply) => {
      const sponsorId = Number(request.params.id);
      // findFirst, not findUnique: a trashed sponsor must not gain new contacts.
      const sponsor = await prisma.sponsor.findFirst({ where: { id: sponsorId, ...notDeleted } });
      if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

      const email = request.body.email?.trim();
      if (!email) return reply.code(400).send({ error: "No contact email provided" });

      // Send first, persist second (#223): if the mail fails we create nothing.
      const token = generateEditToken();
      try {
        await sendEditLinkEmail({ to: email, name: sponsor.name, token, kind: "sponsor", locale: sponsor.locale });
      } catch (err) {
        request.log.error({ err }, "Failed to send sponsor edit link email");
        return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
      }

      const contact = await prisma.sponsorContact.create({
        data: {
          sponsorId,
          email,
          name: request.body.name?.trim() || null,
          role: request.body.role?.trim() || null,
          editToken: token,
          editTokenSentAt: new Date(),
        },
      });
      return reply.code(201).send(serializeContact(contact));
    },
  );

  // POST /api/admin/sponsors/:id/contacts/:contactId/resend — rotate + resend.
  app.post<{ Params: SponsorIdParams & { contactId: string } }>(
    "/sponsors/:id/contacts/:contactId/resend",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const contact = await prisma.sponsorContact.findUnique({
        where: { id: Number(request.params.contactId) },
        include: { sponsor: true },
      });
      if (!contact || contact.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Contact not found" });
      }

      const token = generateEditToken();
      try {
        await sendEditLinkEmail({ to: contact.email, name: contact.sponsor.name, token, kind: "sponsor", locale: contact.sponsor.locale });
      } catch (err) {
        request.log.error({ err }, "Failed to resend sponsor edit link email");
        return reply.code(502).send({ error: "Email sending failed", detail: "retry" });
      }

      const updated = await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: { editToken: token, editLinkLocked: false, editTokenSentAt: new Date() },
      });
      return serializeContact(updated);
    },
  );

  // PUT /api/admin/sponsors/:id/contacts/:contactId/lock — lock/unlock a link.
  app.put<{ Params: SponsorIdParams & { contactId: string }; Body: { locked: boolean } }>(
    "/sponsors/:id/contacts/:contactId/lock",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const contact = await prisma.sponsorContact.findUnique({ where: { id: Number(request.params.contactId) } });
      if (!contact || contact.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Contact not found" });
      }
      const updated = await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: { editLinkLocked: !!request.body.locked },
      });
      return serializeContact(updated);
    },
  );

  // DELETE /api/admin/sponsors/:id/contacts/:contactId — remove a contact.
  app.delete<{ Params: SponsorIdParams & { contactId: string } }>(
    "/sponsors/:id/contacts/:contactId",
    { schema: { params: { type: "object", required: ["id", "contactId"], properties: { id: { type: "string" }, contactId: { type: "string" } } } } },
    async (request, reply) => {
      const contact = await prisma.sponsorContact.findUnique({ where: { id: Number(request.params.contactId) } });
      if (!contact || contact.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Contact not found" });
      }
      await prisma.sponsorContact.delete({ where: { id: contact.id } });
      return reply.code(204).send();
    },
  );

  // DELETE /api/admin/sponsors/:id/job-offers/:offerId — moderate an offer (#251).
  app.delete<{ Params: SponsorIdParams & { offerId: string } }>(
    "/sponsors/:id/job-offers/:offerId",
    { schema: { params: { type: "object", required: ["id", "offerId"], properties: { id: { type: "string" }, offerId: { type: "string" } } } } },
    async (request, reply) => {
      const offer = await prisma.sponsorJobOffer.findUnique({ where: { id: Number(request.params.offerId) } });
      if (!offer || offer.sponsorId !== Number(request.params.id)) {
        return reply.code(404).send({ error: "Offer not found" });
      }
      await prisma.sponsorJobOffer.delete({ where: { id: offer.id } });
      revalidateSponsors();
      revalidateJobOffers();
      return reply.code(204).send();
    },
  );
}
