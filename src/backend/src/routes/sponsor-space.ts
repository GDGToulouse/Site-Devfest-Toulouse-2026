import type { FastifyInstance } from "fastify";

import { prisma } from "../lib/prisma.js";
import { getAuthContext } from "../lib/auth-context.js";
import { notDeleted } from "../lib/admin-helpers.js";
import { requireSponsorAccess } from "../lib/sponsor-guard.js";
import { applySponsorEdit, writesYearField, type SponsorEditBody } from "../lib/sponsor-write.js";
import { isSafeUrl } from "../lib/sanitize.js";
import { getFeaturedEdition } from "./editions.js";

// Same bounds as the edit link (#223): this endpoint writes fields rendered on
// public pages, so the payload is an allow-list of known keys and lengths.
const TEXT_MAX = 5_000;
const SHORT_MAX = 200;
const URL_MAX = 2_048;
const STAND_CONTACTS_MAX = 20;
const SOCIAL_KEYS = ["linkedin", "twitter", "bluesky", "github", "website"] as const;

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
    return contacts.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      role: c.role,
      accessRole: c.accessRole,
      hasAccount: !!c.userId,
      invitationSentAt: c.invitationSentAt,
      invitationAcceptedAt: c.invitationAcceptedAt,
    }));
  });
}
