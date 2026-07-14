import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { isEditingFrozen, isEditTokenExpired } from "../lib/edit-token.js";
import { normalizeLocale } from "../lib/edit-link-email.js";
import { isSafeUrl } from "../lib/sanitize.js";
import { revalidateSpeakers, revalidateSponsors } from "../lib/revalidate.js";

// This is the only unauthenticated endpoint that writes to the database and
// whose content is rendered on public pages, so everything below is an
// allowlist: known fields, bounded lengths, http(s) URLs only (#223).
const TEXT_MAX = 5_000;
const SHORT_MAX = 200;
const URL_MAX = 2_048;

const SOCIAL_KEYS = ["linkedin", "twitter", "github", "website"] as const;

const socialLinksSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(
    SOCIAL_KEYS.map((k) => [k, { type: "string", maxLength: URL_MAX }]),
  ),
};

const speakerBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bioFr: { type: "string", maxLength: TEXT_MAX },
    bioEn: { type: "string", maxLength: TEXT_MAX },
    company: { type: "string", maxLength: SHORT_MAX },
    city: { type: "string", maxLength: SHORT_MAX },
    photoUrl: { type: "string", maxLength: URL_MAX },
    socialLinks: socialLinksSchema,
  },
};

const sponsorBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    descriptionFr: { type: "string", maxLength: TEXT_MAX },
    descriptionEn: { type: "string", maxLength: TEXT_MAX },
    websiteUrl: { type: "string", maxLength: URL_MAX },
    logoUrl: { type: "string", maxLength: URL_MAX },
    socialLinks: socialLinksSchema,
  },
};

// The token resolves to either kind, so the body schema can't be picked by
// Fastify upfront — accept the union and validate the rest by hand.
const editBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: { ...speakerBodySchema.properties, ...sponsorBodySchema.properties },
};

const ALLOWED_FIELDS = Object.keys(editBodySchema.properties);

// Fastify's Ajv runs with `removeAdditional: true`, so `additionalProperties:
// false` silently STRIPS an unknown key instead of rejecting it: a PUT carrying
// `name` or `publicationStatus` answered 200 while quietly ignoring them.
// Telling a caller "saved" after discarding half their payload is worse than
// refusing it, so unknown keys are rejected explicitly — in a preValidation
// hook, which sees the body *before* Ajv prunes it (#223).
function findForbiddenKey(body: Record<string, unknown>): string | null {
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.includes(key)) return key;
  }
  const social = body.socialLinks;
  if (social && typeof social === "object") {
    for (const key of Object.keys(social as Record<string, unknown>)) {
      if (!(SOCIAL_KEYS as readonly string[]).includes(key)) return `socialLinks.${key}`;
    }
  }
  return null;
}

// An empty string clears the field; anything else must be a safe URL. Returns
// the offending field name, or null when every URL is acceptable.
function findUnsafeUrl(body: Record<string, unknown>): string | null {
  for (const field of ["photoUrl", "logoUrl", "websiteUrl"]) {
    const value = body[field];
    if (typeof value === "string" && value.trim() && !isSafeUrl(value)) return field;
  }
  const social = body.socialLinks;
  if (social && typeof social === "object") {
    for (const [key, value] of Object.entries(social as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim() && !isSafeUrl(value)) return `socialLinks.${key}`;
    }
  }
  return null;
}

// Drop empty social entries so clearing a field doesn't persist "".
function cleanSocial(social: Record<string, string> | undefined): string | null {
  if (!social) return null;
  const kept = Object.entries(social).filter(([, v]) => typeof v === "string" && v.trim());
  return kept.length ? JSON.stringify(Object.fromEntries(kept)) : null;
}

// Resolve a modification token to either a speaker or a sponsor. Returns null
// if no entity carries this token.
async function resolveToken(token: string) {
  const speaker = await prisma.speaker.findUnique({
    where: { editToken: token },
    include: { edition: { select: { startDate: true } } },
  });
  if (speaker) return { kind: "speaker" as const, entity: speaker };

  const sponsor = await prisma.sponsor.findUnique({
    where: { editToken: token },
    include: { edition: { select: { startDate: true } } },
  });
  if (sponsor) return { kind: "sponsor" as const, entity: sponsor };

  return null;
}

function parseSocial(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as unknown;
    return p && typeof p === "object" ? (p as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Locked (RG-245), frozen 48h before the event (RG-246) or expired (#223).
// Same gate on read and on write — a link one cannot save through must not
// present an editable form either.
function editingBlockedReason(entity: {
  editLinkLocked: boolean;
  editTokenSentAt: Date | null;
  edition: { startDate: Date | null };
}): "locked" | "frozen" | "expired" | null {
  if (entity.editLinkLocked) return "locked";
  if (isEditingFrozen(entity.edition.startDate)) return "frozen";
  if (isEditTokenExpired(entity.editTokenSentAt)) return "expired";
  return null;
}

interface SpeakerEditBody {
  bioFr?: string;
  bioEn?: string;
  company?: string;
  city?: string;
  photoUrl?: string;
  socialLinks?: Record<string, string>;
}
interface SponsorEditBody {
  descriptionFr?: string;
  descriptionEn?: string;
  websiteUrl?: string;
  logoUrl?: string;
  socialLinks?: Record<string, string>;
}

export default async function editRoutes(app: FastifyInstance) {
  // GET /api/edit/:token — load the editable fields of the entity behind the token.
  app.get<{ Params: { token: string } }>("/edit/:token", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    schema: { params: { type: "object", required: ["token"], properties: { token: { type: "string" } } } },
  }, async (request, reply) => {
    const resolved = await resolveToken(request.params.token);
    // Invalid/unknown token -> 404 (RG-249 cas limite).
    if (!resolved) return reply.code(404).send({ error: "invalid_token" });

    const { kind, entity } = resolved;
    const locale = normalizeLocale(entity.locale);
    // The locale rides along even on a refusal (#224): a blocked link must
    // explain itself in the recipient's language, not in French by default.
    const blocked = editingBlockedReason(entity);
    if (blocked) return reply.code(403).send({ error: blocked, locale });

    if (kind === "speaker") {
      return {
        kind,
        locale,
        name: entity.name,
        fields: {
          bioFr: entity.bioFr,
          bioEn: entity.bioEn,
          company: entity.company,
          city: entity.city,
          photoUrl: entity.photoUrl,
          socialLinks: parseSocial(entity.socialLinks),
        },
      };
    }
    return {
      kind,
      locale,
      name: entity.name,
      fields: {
        descriptionFr: entity.descriptionFr,
        descriptionEn: entity.descriptionEn,
        websiteUrl: entity.websiteUrl,
        logoUrl: entity.logoUrl,
        socialLinks: parseSocial(entity.socialLinks),
      },
    };
  });

  // PUT /api/edit/:token — save the editable fields. Name, sessions, level and
  // publication status are NOT editable here (RG-247).
  app.put<{ Params: { token: string }; Body: SpeakerEditBody | SponsorEditBody }>("/edit/:token", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: { type: "object", required: ["token"], properties: { token: { type: "string" } } },
      body: editBodySchema,
    },
    // Runs before Ajv, so the body still carries any unknown key the caller sent.
    preValidation: async (request, reply) => {
      const body = request.body;
      if (!body || typeof body !== "object") return;
      const forbidden = findForbiddenKey(body as Record<string, unknown>);
      if (forbidden) {
        return reply.code(400).send({ error: "forbidden_field", field: forbidden });
      }
    },
  }, async (request, reply) => {
    const resolved = await resolveToken(request.params.token);
    if (!resolved) return reply.code(404).send({ error: "invalid_token" });

    const { kind, entity } = resolved;
    const blocked = editingBlockedReason(entity);
    if (blocked) return reply.code(403).send({ error: blocked });

    // The schema bounds the shape; scheme allowlisting is what stops a
    // `javascript:` URL from reaching a public href.
    const unsafeField = findUnsafeUrl(request.body as Record<string, unknown>);
    if (unsafeField) {
      return reply.code(400).send({ error: "invalid_url", field: unsafeField });
    }

    if (kind === "speaker") {
      const body = request.body as SpeakerEditBody;
      // A field absent from the body is left untouched; an empty string clears it.
      await prisma.speaker.update({
        where: { id: entity.id },
        data: {
          ...(body.bioFr !== undefined && { bioFr: body.bioFr || null }),
          ...(body.bioEn !== undefined && { bioEn: body.bioEn || null }),
          ...(body.company !== undefined && { company: body.company || null }),
          ...(body.city !== undefined && { city: body.city || null }),
          ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl || null }),
          ...(body.socialLinks !== undefined && { socialLinks: cleanSocial(body.socialLinks) }),
        },
      });
      revalidateSpeakers();
    } else {
      const body = request.body as SponsorEditBody;
      await prisma.sponsor.update({
        where: { id: entity.id },
        data: {
          ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr || null }),
          ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn || null }),
          ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl || null }),
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
          ...(body.socialLinks !== undefined && { socialLinks: cleanSocial(body.socialLinks) }),
        },
      });
      revalidateSponsors();
    }

    return { saved: true };
  });
}
