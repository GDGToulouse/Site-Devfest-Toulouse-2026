import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { getAuthContext } from "../lib/auth-context.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { requireSponsorAccess, type SponsorAccessRole } from "../lib/sponsor-guard.js";
import { generateInvitationToken } from "../lib/edit-token.js";
import { resolveInitialAccessRole } from "../lib/sponsor-invitation.js";
import { sendSponsorInvitationEmail } from "../lib/edit-link-email.js";
import { applySponsorEdit, writesYearField, type SponsorEditBody } from "../lib/sponsor-write.js";
import { isSafeUrl, sanitizeRichHtml } from "../lib/sanitize.js";
import { storeImageBuffer, UnsafeSvgError } from "../lib/image-store.js";
import { revalidateJobOffers, revalidateSponsors } from "../lib/revalidate.js";
import { getFeaturedEdition } from "./editions.js";

// Same bounds as the edit link (#223): this endpoint writes fields rendered on
// public pages, so the payload is an allow-list of known keys and lengths.
const TEXT_MAX = 5_000;
const SHORT_MAX = 200;
const URL_MAX = 2_048;
const STAND_CONTACTS_MAX = 20;
const SOCIAL_KEYS = ["linkedin", "twitter", "bluesky", "github", "website"] as const;

// Validated against a plain allow-list so an unknown value is a 422 rather than
// a Prisma error surfacing as a 500.
const ACCESS_ROLES: SponsorAccessRole[] = ["RESPONSABLE", "EDITEUR", "STAND"];

// Same bounds as the edit link. SVG is allowed because storeImageBuffer strips
// scripts, handlers and remote references before the file reaches the disk, and
// .svg is served under a sandbox CSP (#346) — a vector logo is exactly what a
// sponsor has to hand. PDF is the com-kit charter, a document rather than an
// image (#374): storeImageBuffer stores it as-is, never passing it to sharp.
const UPLOAD_MAX_SIZE = 5_000_000; // 5 MB
const UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

interface JobOfferBody {
  title: string;
  descriptionFr?: string;
  descriptionEn?: string;
  url: string;
}

const jobOfferBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "url"],
  properties: {
    title: { type: "string", maxLength: SHORT_MAX },
    descriptionFr: { type: "string", maxLength: TEXT_MAX },
    descriptionEn: { type: "string", maxLength: TEXT_MAX },
    url: { type: "string", maxLength: URL_MAX },
  },
} as const;

// What a sponsor may write about itself. `name`, `slug` and the tier are the
// organisers' business: renaming the company here would break its slug and its
// public page.
const EDITABLE_FIELDS: string[] = [
  "descriptionFr",
  "descriptionEn",
  "websiteUrl",
  "logoUrl",
  "socialLinks",
  "standContacts",
  "comKitReceived",
  "comKitLogoWebUrl",
  "comKitLogoPrintUrl",
  "comKitCharterUrl",
  "comKitNotes",
  "platinumPromoIdea",
  "platinumCoBuildIdea",
];

// A sponsor's own space (#362) — what a company sees about itself once it has
// an account, as opposed to /api/admin/* (organisers) and /api/edit/:token
// (editing without an account, still in service for speakers).

const sponsorIdParams = {
  type: "object",
  required: ["sponsorId"],
  properties: { sponsorId: { type: "string" } },
} as const;

export default async function sponsorSpaceRoutes(app: FastifyInstance) {
  // GET /api/sponsor-space/mine — the companies this account may act on.
  //
  // The entry point: a person invited by two companies has to pick one, and the
  // frontend cannot guess the ids on its own.
  app.get("/sponsor-space/mine", async (request, reply) => {
    const ctx = await getAuthContext(request);
    if (!ctx) return reply.code(401).send({ error: "Unauthenticated" });

    const contacts = await prisma.sponsorContact.findMany({
      where: { userId: ctx.user.id, sponsor: notDeleted },
      select: {
        accessRole: true,
        sponsor: { select: { id: true, slug: true, name: true, logoUrl: true } },
      },
      orderBy: { sponsor: { name: "asc" } },
    });

    return contacts.map((c) => ({ ...c.sponsor, accessRole: c.accessRole }));
  });

  // GET /api/sponsor-space/:sponsorId — the company's own profile.
  //
  // STAND may read it: the booth team needs to know what the page says, which
  // is public anyway. Private fields are NOT here — see /private below.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("STAND"),
  }, async (request, reply) => {
    const sponsorId = request.sponsorAccess!.sponsorId;
    const sponsor = await prisma.sponsor.findFirst({
      where: { id: sponsorId, ...notDeleted },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        websiteUrl: true,
        descriptionFr: true,
        descriptionEn: true,
        socialLinks: true,
        editions: {
          where: { edition: notDeleted },
          select: {
            editionId: true,
            edition: { select: { year: true } },
            publicationStatus: true,
            tier: { select: { key: true, nameFr: true, nameEn: true } },
          },
          orderBy: { edition: { year: "desc" } },
        },
      },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

    return {
      ...sponsor,
      socialLinks: sponsor.socialLinks ? JSON.parse(sponsor.socialLinks) : {},
      accessRole: request.sponsorAccess!.accessRole,
    };
  });

  // GET /api/sponsor-space/:sponsorId/private — the com kit and booth notes.
  //
  // EDITEUR and above only: STAND is read-only on the public profile and has no
  // business seeing what the organisers and the company exchange privately.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/private", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("EDITEUR"),
  }, async (request, reply) => {
    const sponsorId = request.sponsorAccess!.sponsorId;
    const sponsor = await prisma.sponsor.findFirst({
      where: { id: sponsorId, ...notDeleted },
      select: {
        standContacts: true,
        editions: {
          where: { edition: notDeleted },
          select: {
            editionId: true,
            edition: { select: { year: true } },
            comKitReceived: true,
            comKitLogoWebUrl: true,
            comKitLogoPrintUrl: true,
            comKitCharterUrl: true,
            comKitNotes: true,
            platinumPromoIdea: true,
            platinumCoBuildIdea: true,
            tier: { select: { allowsPromoIdeas: true } },
          },
          orderBy: { edition: { year: "desc" } },
        },
      },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

    return {
      standContacts: sponsor.standContacts ? JSON.parse(sponsor.standContacts) : [],
      editions: sponsor.editions,
    };
  });

  // PUT /api/sponsor-space/:sponsorId — save the company's own fields.
  //
  // EDITEUR and above: STAND is read-only by design. Writes go through the same
  // helper as the edit link (#362), so the two ways in cannot drift apart on
  // which field belongs to the year and which to the company.
  app.put<{ Params: { sponsorId: string }; Body: SponsorEditBody }>("/sponsor-space/:sponsorId", {
    schema: {
      params: sponsorIdParams,
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          descriptionFr: { type: "string", maxLength: TEXT_MAX },
          descriptionEn: { type: "string", maxLength: TEXT_MAX },
          websiteUrl: { type: "string", maxLength: URL_MAX },
          logoUrl: { type: "string", maxLength: URL_MAX },
          socialLinks: {
            type: "object",
            additionalProperties: false,
            properties: Object.fromEntries(
              SOCIAL_KEYS.map((k) => [k, { type: "string", maxLength: URL_MAX }]),
            ),
          },
          standContacts: {
            type: "array",
            maxItems: STAND_CONTACTS_MAX,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string", maxLength: SHORT_MAX },
                linkedin: { type: "string", maxLength: URL_MAX },
                twitter: { type: "string", maxLength: URL_MAX },
                bluesky: { type: "string", maxLength: URL_MAX },
              },
            },
          },
          comKitReceived: { type: "boolean" },
          comKitLogoWebUrl: { type: "string", maxLength: URL_MAX },
          comKitLogoPrintUrl: { type: "string", maxLength: URL_MAX },
          comKitCharterUrl: { type: "string", maxLength: URL_MAX },
          comKitNotes: { type: "string", maxLength: TEXT_MAX },
          platinumPromoIdea: { type: "string", maxLength: TEXT_MAX },
          platinumCoBuildIdea: { type: "string", maxLength: TEXT_MAX },
        },
      },
    },
    // Ajv runs with `removeAdditional: true`, so `additionalProperties: false`
    // silently STRIPS an unknown key instead of rejecting it — a PUT carrying
    // `name` would answer 200 while ignoring it. Telling a caller "saved" after
    // discarding half their payload is worse than refusing it, so unknown keys
    // are caught here, before Ajv prunes them (#223).
    preValidation: async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(body)) {
        if (!EDITABLE_FIELDS.includes(key)) {
          return reply.code(400).send({ error: "unknown_field", field: key });
        }
      }
      const social = body.socialLinks;
      if (social && typeof social === "object") {
        for (const key of Object.keys(social as Record<string, unknown>)) {
          if (!(SOCIAL_KEYS as readonly string[]).includes(key)) {
            return reply.code(400).send({ error: "unknown_field", field: `socialLinks.${key}` });
          }
        }
      }
    },
    preHandler: requireSponsorAccess("EDITEUR"),
  }, async (request, reply) => {
    const sponsorId = request.sponsorAccess!.sponsorId;
    const body = request.body ?? {};

    // Same allow-list as the edit link (#223): http(s) only, so a saved field
    // cannot turn into a javascript: link on the public page.
    for (const field of ["logoUrl", "websiteUrl", "comKitLogoWebUrl", "comKitLogoPrintUrl", "comKitCharterUrl"] as const) {
      const value = body[field];
      if (typeof value === "string" && value.trim() && !isSafeUrl(value)) {
        return reply.code(400).send({ error: "unsafe_url", field });
      }
    }
    for (const [key, value] of Object.entries(body.socialLinks ?? {})) {
      if (typeof value === "string" && value.trim() && !isSafeUrl(value)) {
        return reply.code(400).send({ error: "unsafe_url", field: `socialLinks.${key}` });
      }
    }

    const sponsor = await prisma.sponsor.findFirst({
      where: { id: sponsorId, ...notDeleted },
      select: { id: true, slug: true },
    });
    if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

    // Per-year fields land on the featured edition's participation — the year
    // being prepared. Editing a past one is the organisers' job.
    const edition = await getFeaturedEdition();
    const participation = edition
      ? await prisma.editionSponsor.findFirst({
          where: { sponsorId, editionId: edition.id, edition: notDeleted },
          select: { id: true, tier: { select: { allowsPromoIdeas: true } } },
        })
      : null;

    if (writesYearField(body) && !participation) {
      return reply.code(422).send({ error: "no_current_participation" });
    }

    await applySponsorEdit({ sponsorId, sponsorSlug: sponsor.slug, participation, body });
    return { saved: true };
  });

  // GET /api/sponsor-space/:sponsorId/team — who has access, and as what.
  //
  // RESPONSABLE only: the team list carries the colleagues' addresses, which an
  // EDITEUR has no reason to enumerate.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/team", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("RESPONSABLE"),
  }, async (request) => {
    const contacts = await prisma.sponsorContact.findMany({
      where: { sponsorId: request.sponsorAccess!.sponsorId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accessRole: true,
        userId: true,
        invitationSentAt: true,
        invitationAcceptedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Tokens never leave the server — only whether an invitation is pending.
    return contacts.map(serializeMember);
  });

  // POST /api/sponsor-space/:sponsorId/team — invite someone onto the space.
  //
  // RESPONSABLE only (#362): that is the whole difference with EDITEUR. The
  // company invites its own colleagues without going through the organisers.
  app.post<{ Params: { sponsorId: string }; Body: { email?: string; name?: string; accessRole?: SponsorAccessRole } }>(
    "/sponsor-space/:sponsorId/team",
    { schema: { params: sponsorIdParams }, preHandler: requireSponsorAccess("RESPONSABLE") },
    async (request, reply) => {
      const sponsorId = request.sponsorAccess!.sponsorId;
      const email = request.body?.email?.trim();
      if (!email) return reply.code(400).send({ error: "email_required" });

      const accessRole = request.body?.accessRole ?? "EDITEUR";
      if (!ACCESS_ROLES.includes(accessRole)) {
        return reply.code(422).send({ error: "invalid_access_role" });
      }

      const sponsor = await prisma.sponsor.findFirst({
        where: { id: sponsorId, ...notDeleted },
        select: { name: true, locale: true },
      });
      if (!sponsor) return reply.code(404).send({ error: "Sponsor not found" });

      // Re-inviting an address already on the team would create a second row
      // for the same person, each with its own role — and no way to tell which
      // one applies.
      const existing = await prisma.sponsorContact.findFirst({
        where: { sponsorId, email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) return reply.code(409).send({ error: "already_on_team" });

      // Send first, persist second (#223): a failed mail must leave no
      // invitation behind.
      const token = generateInvitationToken();
      try {
        await sendSponsorInvitationEmail({
          to: email,
          sponsorName: sponsor.name,
          token,
          locale: sponsor.locale,
        });
      } catch (err) {
        request.log.error({ err }, "Failed to send sponsor team invitation");
        return reply.code(502).send({ error: "email_failed" });
      }

      // Normally unreachable — the guard above already requires a RESPONSABLE.
      // It fires for the ADMIN override, which acts without holding a contact
      // of its own: the member an organiser adds to an empty space must be able
      // to run it (#362). The contact does not exist yet, hence the -1.
      const promoted = await resolveInitialAccessRole(sponsorId, -1);

      const contact = await prisma.sponsorContact.create({
        data: {
          sponsorId,
          email,
          name: request.body?.name?.trim() || null,
          accessRole: promoted ?? accessRole,
          invitationToken: token,
          invitationSentAt: new Date(),
        },
      });
      return reply.code(201).send(serializeMember(contact));
    },
  );

  // PUT /api/sponsor-space/:sponsorId/team/:contactId — change a member's role.
  app.put<{ Params: { sponsorId: string; contactId: string }; Body: { accessRole?: SponsorAccessRole } }>(
    "/sponsor-space/:sponsorId/team/:contactId",
    {
      schema: {
        params: {
          type: "object",
          required: ["sponsorId", "contactId"],
          properties: { sponsorId: { type: "string" }, contactId: { type: "string" } },
        },
      },
      preHandler: requireSponsorAccess("RESPONSABLE"),
    },
    async (request, reply) => {
      const sponsorId = request.sponsorAccess!.sponsorId;
      const accessRole = request.body?.accessRole;
      if (!accessRole || !ACCESS_ROLES.includes(accessRole)) {
        return reply.code(422).send({ error: "invalid_access_role" });
      }

      const contact = await prisma.sponsorContact.findUnique({
        where: { id: Number(request.params.contactId) },
        select: { id: true, sponsorId: true, accessRole: true },
      });
      if (!contact || contact.sponsorId !== sponsorId) {
        return reply.code(404).send({ error: "Contact not found" });
      }

      if (await wouldStrandSpace(sponsorId, contact, accessRole)) {
        return reply.code(409).send({ error: "last_responsable" });
      }

      const updated = await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: { accessRole },
      });
      return serializeMember(updated);
    },
  );

  // DELETE /api/sponsor-space/:sponsorId/team/:contactId — revoke access.
  //
  // Removes the contact outright: it exists to carry the access, unlike the
  // organisers' own contact list which survives on the admin side.
  app.delete<{ Params: { sponsorId: string; contactId: string } }>(
    "/sponsor-space/:sponsorId/team/:contactId",
    {
      schema: {
        params: {
          type: "object",
          required: ["sponsorId", "contactId"],
          properties: { sponsorId: { type: "string" }, contactId: { type: "string" } },
        },
      },
      preHandler: requireSponsorAccess("RESPONSABLE"),
    },
    async (request, reply) => {
      const sponsorId = request.sponsorAccess!.sponsorId;
      const contact = await prisma.sponsorContact.findUnique({
        where: { id: Number(request.params.contactId) },
        select: { id: true, sponsorId: true, accessRole: true },
      });
      if (!contact || contact.sponsorId !== sponsorId) {
        return reply.code(404).send({ error: "Contact not found" });
      }

      // Same guard as demoting: removing the last RESPONSABLE would leave the
      // space with nobody able to invite anyone back into it.
      if (await wouldStrandSpace(sponsorId, contact, null)) {
        return reply.code(409).send({ error: "last_responsable" });
      }

      await prisma.sponsorContact.delete({ where: { id: contact.id } });
      return reply.code(204).send();
    },
  );

  // --- Job offers (#251) -----------------------------------------------------
  //
  // Offers hang off the participation, not the company: a company sponsoring two
  // years advertises different jobs each time, and the tier that sets the quota
  // is per-year too.

  // GET /api/sponsor-space/:sponsorId/job-offers — the year's offers and quota.
  //
  // STAND may read: the offers are published on a public page anyway, and a
  // stand host being able to see what their own company advertises is the point.
  app.get<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/job-offers", {
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("STAND"),
  }, async (request, reply) => {
    const participation = await loadCurrentParticipation(request.sponsorAccess!.sponsorId);
    if (!participation) return reply.code(422).send({ error: "no_current_participation" });

    return {
      quota: participation.tier.jobOfferQuota,
      offers: participation.jobOffers.map(serializeJobOffer),
    };
  });

  // POST /api/sponsor-space/:sponsorId/job-offers — create one, within quota.
  app.post<{ Params: { sponsorId: string }; Body: JobOfferBody }>("/sponsor-space/:sponsorId/job-offers", {
    schema: { params: sponsorIdParams, body: jobOfferBodySchema },
    preHandler: requireSponsorAccess("EDITEUR"),
  }, async (request, reply) => {
    const participation = await loadCurrentParticipation(request.sponsorAccess!.sponsorId);
    if (!participation) return reply.code(422).send({ error: "no_current_participation" });

    const { title, url } = request.body;
    if (!title.trim()) return reply.code(400).send({ error: "empty_title" });
    if (!isSafeUrl(url)) return reply.code(400).send({ error: "invalid_url", field: "url" });

    // A lowered tier keeps the offers already published but blocks new ones
    // beyond the new cap (#251).
    const quota = participation.tier.jobOfferQuota;
    if (participation.jobOffers.length >= quota) {
      return reply.code(409).send({ error: "quota_reached", quota });
    }

    const offer = await prisma.sponsorJobOffer.create({
      data: {
        editionSponsorId: participation.id,
        title: title.trim(),
        descriptionFr: sanitizeRichHtml(request.body.descriptionFr),
        descriptionEn: sanitizeRichHtml(request.body.descriptionEn),
        url: url.trim(),
      },
    });
    revalidateSponsors();
    revalidateJobOffers();
    return reply.code(201).send(serializeJobOffer(offer));
  });

  // PUT /api/sponsor-space/:sponsorId/job-offers/:offerId — edit one.
  app.put<{ Params: { sponsorId: string; offerId: string }; Body: Partial<JobOfferBody> }>(
    "/sponsor-space/:sponsorId/job-offers/:offerId",
    {
      schema: {
        params: {
          type: "object",
          required: ["sponsorId", "offerId"],
          properties: { sponsorId: { type: "string" }, offerId: { type: "string", pattern: "^[0-9]+$" } },
        },
        body: { type: "object", additionalProperties: false, properties: jobOfferBodySchema.properties },
      },
      preHandler: requireSponsorAccess("EDITEUR"),
    },
    async (request, reply) => {
      const participation = await loadCurrentParticipation(request.sponsorAccess!.sponsorId);
      if (!participation) return reply.code(422).send({ error: "no_current_participation" });

      // Ownership: an id belonging to another company answers 404, never 403 —
      // same reasoning as the guard, ids must not be probeable.
      const offer = participation.jobOffers.find((o) => o.id === Number(request.params.offerId));
      if (!offer) return reply.code(404).send({ error: "offer_not_found" });

      const body = request.body ?? {};
      if (body.title !== undefined && !body.title.trim()) return reply.code(400).send({ error: "empty_title" });
      if (body.url !== undefined && !isSafeUrl(body.url)) return reply.code(400).send({ error: "invalid_url", field: "url" });

      const updated = await prisma.sponsorJobOffer.update({
        where: { id: offer.id },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() }),
          ...(body.descriptionFr !== undefined && { descriptionFr: sanitizeRichHtml(body.descriptionFr) }),
          ...(body.descriptionEn !== undefined && { descriptionEn: sanitizeRichHtml(body.descriptionEn) }),
          ...(body.url !== undefined && { url: body.url.trim() }),
        },
      });
      revalidateSponsors();
      revalidateJobOffers();
      return serializeJobOffer(updated);
    },
  );

  // DELETE /api/sponsor-space/:sponsorId/job-offers/:offerId — remove one.
  app.delete<{ Params: { sponsorId: string; offerId: string } }>(
    "/sponsor-space/:sponsorId/job-offers/:offerId",
    {
      schema: {
        params: {
          type: "object",
          required: ["sponsorId", "offerId"],
          properties: { sponsorId: { type: "string" }, offerId: { type: "string", pattern: "^[0-9]+$" } },
        },
      },
      preHandler: requireSponsorAccess("EDITEUR"),
    },
    async (request, reply) => {
      const participation = await loadCurrentParticipation(request.sponsorAccess!.sponsorId);
      if (!participation) return reply.code(422).send({ error: "no_current_participation" });

      const offer = participation.jobOffers.find((o) => o.id === Number(request.params.offerId));
      if (!offer) return reply.code(404).send({ error: "offer_not_found" });

      await prisma.sponsorJobOffer.delete({ where: { id: offer.id } });
      revalidateSponsors();
      revalidateJobOffers();
      return reply.code(204).send();
    },
  );

  // POST /api/sponsor-space/:sponsorId/upload — store a logo or a com-kit file.
  //
  // Rate-limited: unlike the rest of this file, a call here writes to disk, and
  // an account is not a reason to let someone fill it.
  app.post<{ Params: { sponsorId: string } }>("/sponsor-space/:sponsorId/upload", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: { params: sponsorIdParams },
    preHandler: requireSponsorAccess("EDITEUR"),
  }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: UPLOAD_MAX_SIZE } });
    if (!data) return reply.code(400).send({ error: "no_file" });

    if (!UPLOAD_MIMES.has(data.mimetype)) {
      await data.toBuffer(); // drain the stream so the request doesn't hang
      return reply.code(400).send({ error: "invalid_file_type" });
    }

    const buffer = await data.toBuffer();
    if (data.file.truncated) return reply.code(413).send({ error: "file_too_large" });

    try {
      const url = await storeImageBuffer(buffer, data.mimetype);
      return { url };
    } catch (err) {
      // An SVG whose only content was executable leaves nothing to render —
      // tell the sponsor their file was refused rather than return a 500.
      if (err instanceof UnsafeSvgError) {
        return reply.code(400).send({ error: "invalid_file_type" });
      }
      throw err;
    }
  });
}

// The year's participation with everything the job-offer routes need: the
// offers themselves and the tier that caps them.
async function loadCurrentParticipation(sponsorId: number) {
  const edition = await getFeaturedEdition();
  if (!edition) return null;
  return prisma.editionSponsor.findFirst({
    where: { sponsorId, editionId: edition.id, edition: notDeleted },
    select: {
      id: true,
      tier: { select: { jobOfferQuota: true } },
      jobOffers: {
        select: { id: true, title: true, descriptionFr: true, descriptionEn: true, url: true },
        orderBy: { id: "asc" },
      },
    },
  });
}

function serializeJobOffer(o: {
  id: number;
  title: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  url: string;
}) {
  return {
    id: o.id,
    title: o.title,
    descriptionFr: o.descriptionFr,
    descriptionEn: o.descriptionEn,
    url: o.url,
  };
}

// Would this change leave the space without a single RESPONSABLE? Passing null
// as the next role means the contact is being removed altogether.
async function wouldStrandSpace(
  sponsorId: number,
  contact: { id: number; accessRole: SponsorAccessRole },
  nextRole: SponsorAccessRole | null,
): Promise<boolean> {
  if (contact.accessRole !== "RESPONSABLE") return false;
  if (nextRole === "RESPONSABLE") return false;
  const others = await prisma.sponsorContact.count({
    where: { sponsorId, accessRole: "RESPONSABLE", id: { not: contact.id } },
  });
  return others === 0;
}

// Tokens never leave the server — only whether an invitation is outstanding.
function serializeMember(c: {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  accessRole: SponsorAccessRole;
  userId: string | null;
  invitationSentAt: Date | null;
  invitationAcceptedAt: Date | null;
}) {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    role: c.role,
    accessRole: c.accessRole,
    hasAccount: !!c.userId,
    invitationSentAt: c.invitationSentAt,
    invitationAcceptedAt: c.invitationAcceptedAt,
  };
}
