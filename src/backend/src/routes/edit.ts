import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { isEditingFrozen, isEditTokenExpired } from "../lib/edit-token.js";
import { normalizeLocale } from "../lib/edit-link-email.js";
import { isSafeUrl } from "../lib/sanitize.js";
import {
  revalidateConferences,
  revalidateJobOffers,
  revalidateSpeakers,
  revalidateSpeaker,
  revalidateSponsors,
} from "../lib/revalidate.js";
import { storeImageBuffer, UnsafeSvgError } from "../lib/image-store.js";
import { sendEmail, escapeHtml } from "../lib/email.js";
import { emailButton, emailHeading } from "../lib/email-template.js";
import { getCfpNotificationEmail } from "../lib/cfp-settings.js";
import { getSponsorContactRecipients } from "../lib/sponsor-contact.js";
import { sanitizeRichHtml } from "../lib/sanitize.js";

// This is the only unauthenticated endpoint that writes to the database and
// whose content is rendered on public pages, so everything below is an
// allowlist: known fields, bounded lengths, http(s) URLs only (#223).
const TEXT_MAX = 5_000;
const SHORT_MAX = 200;
const URL_MAX = 2_048;

// Logo/photo upload through a token (#241). This endpoint is unauthenticated —
// the token is the only credential — so it long refused SVG outright: an
// uploaded one is served same-origin with its native content-type and would run
// JS in a visitor's browser.
//
// Allowed again since #346, because storeImageBuffer strips scripts, handlers
// and remote references before the file reaches the disk, and .svg is served
// under a sandbox CSP. A vector logo is exactly what a sponsor has to hand, so
// the narrower rule cost more than it protected once the payload was neutered.
const UPLOAD_MAX_SIZE = 5_000_000; // 5 MB
const UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const SOCIAL_KEYS = ["linkedin", "twitter", "bluesky", "github", "website"] as const;

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

// Booth staff whose social handles the organizers relay on the day (#249).
// Private: never rendered publicly. A bounded list of bounded strings.
const STAND_CONTACTS_MAX = 20;
const standContactsSchema = {
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
    // Private fields (#249) — organizers only, never exposed on public pages.
    standContacts: standContactsSchema,
    comKitReceived: { type: "boolean" },
    comKitLogoWebUrl: { type: "string", maxLength: URL_MAX },
    comKitLogoPrintUrl: { type: "string", maxLength: URL_MAX },
    comKitCharterUrl: { type: "string", maxLength: URL_MAX },
    comKitNotes: { type: "string", maxLength: TEXT_MAX },
    // Platinum-only (#252). The allowlist accepts them for any sponsor; the
    // PUT ignores them unless the sponsor is Platinum, and the UI only shows
    // them to Platinum sponsors.
    platinumPromoIdea: { type: "string", maxLength: TEXT_MAX },
    platinumCoBuildIdea: { type: "string", maxLength: TEXT_MAX },
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

// Talk fields a speaker may edit from the link (#260, narrowed by #289): the
// wording only. Format, level and language drive the schedule (slot length,
// agenda display) so they moved back to the organizers, alongside programming
// (room, slot, publication status), slug and the speaker list. Editing is also
// opt-in per talk — see Talk.isSpeakerEditable.
const TITLE_MAX = 300;

const talkBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: TITLE_MAX },
    description: { type: "string", maxLength: TEXT_MAX },
  },
};

const TALK_ALLOWED_FIELDS = Object.keys(talkBodySchema.properties);

interface TalkEditBody {
  title?: string;
  description?: string;
}

// The title is the only field that cannot be blank: it's rendered as the session
// heading and the slug was derived from it. The description may be cleared.
function hasBlankTitle(body: TalkEditBody): boolean {
  return body.title !== undefined && !body.title.trim();
}

function findForbiddenTalkKey(body: Record<string, unknown>): string | null {
  for (const key of Object.keys(body)) {
    if (!TALK_ALLOWED_FIELDS.includes(key)) return key;
  }
  return null;
}

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
  for (const field of [
    "photoUrl",
    "logoUrl",
    "websiteUrl",
    // Private com-kit links (#249) — same http(s) allowlist as public URLs.
    "comKitLogoWebUrl",
    "comKitLogoPrintUrl",
    "comKitCharterUrl",
  ]) {
    const value = body[field];
    if (typeof value === "string" && value.trim() && !isSafeUrl(value)) return field;
  }
  const social = body.socialLinks;
  if (social && typeof social === "object") {
    for (const [key, value] of Object.entries(social as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim() && !isSafeUrl(value)) return `socialLinks.${key}`;
    }
  }
  // Booth contacts carry their own social URLs (#249).
  const stand = body.standContacts;
  if (Array.isArray(stand)) {
    for (const [i, contact] of stand.entries()) {
      if (!contact || typeof contact !== "object") continue;
      for (const key of ["linkedin", "twitter", "bluesky"]) {
        const value = (contact as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim() && !isSafeUrl(value)) {
          return `standContacts[${i}].${key}`;
        }
      }
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

interface StandContact {
  name?: string;
  linkedin?: string;
  twitter?: string;
  bluesky?: string;
}

// Trim entries and drop those with no content at all, so an empty row the
// sponsor left behind isn't persisted (#249). Returns null when nothing remains.
function cleanStandContacts(contacts: StandContact[] | undefined): string | null {
  if (!contacts) return null;
  const kept = contacts
    .map((c) => {
      const entry: StandContact = {};
      for (const key of ["name", "linkedin", "twitter", "bluesky"] as const) {
        const v = c[key];
        if (typeof v === "string" && v.trim()) entry[key] = v.trim();
      }
      return entry;
    })
    .filter((c) => Object.keys(c).length > 0);
  return kept.length ? JSON.stringify(kept) : null;
}

function parseStandContacts(raw: string | null): StandContact[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StandContact[]) : [];
  } catch {
    return [];
  }
}

// Resolve a modification token to either a speaker or a sponsor. Returns null
// if no entity carries this token.
async function resolveToken(token: string) {
  const speaker = await prisma.speaker.findUnique({
    where: { editToken: token },
    include: {
      // The 48h freeze (RG-246) keys on an event date, and a global identity no
      // longer has one (#351). The link is sent for the upcoming edition, so the
      // most recent participation is the one that gates editing. No
      // participation at all leaves startDate null, which isEditingFrozen reads
      // as "not frozen" — a speaker must not be locked out by our modelling.
      editions: {
        orderBy: { edition: { year: "desc" } },
        take: 1,
        select: { edition: { select: { startDate: true } } },
      },
      // Sessions the speaker sees from the link (#260). Only published ones are
      // surfaced. Format, level and language are read-only (#289) but still
      // selected: the speaker needs to see how their session is programmed.
      // isSpeakerEditable tells the UI whether to render a form or a plain view.
      talks: {
        where: { publicationStatus: "PUBLISHED" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          format: true,
          level: true,
          language: true,
          isSpeakerEditable: true,
        },
        orderBy: { title: "asc" },
      },
    },
  });
  if (speaker) {
    // Flatten back to the { edition: { startDate } } shape the rest of the route
    // and editingBlockedReason expect, so the join stays contained here.
    const { editions, ...rest } = speaker;
    return {
      kind: "speaker" as const,
      entity: { ...rest, edition: editions[0]?.edition ?? { startDate: null } },
    };
  }

  // Sponsors resolve through their contacts (#250): the token lives on a
  // SponsorContact, and the lock/send-date are per-contact. We flatten the
  // contact's token fields onto the sponsor so the rest of the route (which
  // reads entity.tier, entity.standContacts, entity.id, entity.editLinkLocked,
  // …) keeps working unchanged, and expose contactId/contactEmail for the
  // notification Reply-To.
  const contact = await prisma.sponsorContact.findUnique({
    where: { editToken: token },
    include: {
      sponsor: {
        include: {
          edition: { select: { startDate: true, endDate: true } },
          // Tier drives the job-offer quota and the promo-ideas gating (#317).
          tier: { select: { key: true, nameFr: true, nameEn: true, jobOfferQuota: true, allowsPromoIdeas: true } },
          // Job offers the sponsor can manage from the link (#251).
          jobOffers: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (contact) {
    const entity = {
      ...contact.sponsor,
      editLinkLocked: contact.editLinkLocked,
      editTokenSentAt: contact.editTokenSentAt,
      contactId: contact.id,
      // The link recipient's own address wins over the sponsor's default.
      contactEmail: contact.email || contact.sponsor.contactEmail,
    };
    return { kind: "sponsor" as const, entity };
  }

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
  // Private fields (#249).
  standContacts?: StandContact[];
  comKitReceived?: boolean;
  comKitLogoWebUrl?: string;
  comKitLogoPrintUrl?: string;
  comKitCharterUrl?: string;
  comKitNotes?: string;
  platinumPromoIdea?: string;
  platinumCoBuildIdea?: string;
}

// Notify the organizers that a speaker changed a session. Sent to the
// configurable CFP address (#260); the link points to the admin talk page so
// they can review the change in one click.
async function notifyTalkEdited(
  speakerName: string,
  talk: { id: number; title: string },
): Promise<void> {
  const to = await getCfpNotificationEmail();
  const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const adminUrl = `${baseUrl}/admin/talks/${talk.id}`;

  const subject = `Conférence modifiée par un·e speaker — ${talk.title}`;
  const text = [
    `${speakerName} a mis à jour sa conférence « ${talk.title} ».`,
    "",
    `Les modifications sont déjà en ligne (publication directe).`,
    `Fiche admin : ${adminUrl}`,
  ].join("\n");
  const html = `
    ${emailHeading("Conférence modifiée par un·e speaker")}
    <p><strong>${escapeHtml(speakerName)}</strong> a mis à jour sa conférence
    « ${escapeHtml(talk.title)} ».</p>
    <p>Les modifications sont déjà en ligne (publication directe).</p>
    ${emailButton(adminUrl, "Voir la fiche dans l'admin")}
  `;

  await sendEmail({ to: [to], subject, text, html });
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
        // Editable sessions (#260). The numeric id is required so the client
        // can target PUT /edit/:token/talks/:id; ownership is re-checked
        // server-side on every write, so exposing it opens no door the token
        // didn't already open.
        talks: entity.talks,
      };
    }
    // Where the sponsor should email complements that don't fit as links (#271):
    // the sponsoring contact address, so the client can build a mailto: link.
    const sponsorContactEmail = (await getSponsorContactRecipients())[0];
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
      // Private fields (#249) — served to the token holder so they can edit
      // them, kept in a separate block so the UI can render them apart. The
      // public sponsor route never returns these.
      private: {
        // The sponsoring tier: drives the promo-idea gating and the label shown
        // to the sponsor. Replaces the former legacy `level` string (#321).
        tier: {
          key: entity.tier.key,
          nameFr: entity.tier.nameFr,
          nameEn: entity.tier.nameEn,
          allowsPromoIdeas: entity.tier.allowsPromoIdeas,
        },
        standContacts: parseStandContacts(entity.standContacts),
        comKitReceived: entity.comKitReceived,
        comKitLogoWebUrl: entity.comKitLogoWebUrl,
        comKitLogoPrintUrl: entity.comKitLogoPrintUrl,
        comKitCharterUrl: entity.comKitCharterUrl,
        comKitNotes: entity.comKitNotes,
        // Promo-idea fields (#252). Sent for every sponsor; the UI shows them
        // only when the tier allows promo ideas.
        platinumPromoIdea: entity.platinumPromoIdea,
        platinumCoBuildIdea: entity.platinumCoBuildIdea,
        // Address the sponsor should email complements to (#271). The UI builds
        // a mailto: link from it — no server-side send for this case anymore.
        sponsorContactEmail,
      },
      // Job offers (#251): the sponsor's offers plus its tier quota, so the
      // UI can disable "add" at the cap.
      jobOffers: {
        items: entity.jobOffers.map((o) => ({
          id: o.id,
          title: o.title,
          descriptionFr: o.descriptionFr,
          descriptionEn: o.descriptionEn,
          url: o.url,
        })),
        quota: entity.tier.jobOfferQuota,
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
      // Their own page too (#352), or the bio they just fixed stays stale for an
      // hour on the very page the link is meant to update.
      revalidateSpeaker(entity.slug);
    } else {
      const body = request.body as SponsorEditBody;
      await prisma.sponsor.update({
        where: { id: entity.id },
        data: {
          // Rich-text HTML (#270): sanitized on write, like article content.
          ...(body.descriptionFr !== undefined && { descriptionFr: sanitizeRichHtml(body.descriptionFr) || null }),
          ...(body.descriptionEn !== undefined && { descriptionEn: sanitizeRichHtml(body.descriptionEn) || null }),
          ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl || null }),
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
          ...(body.socialLinks !== undefined && { socialLinks: cleanSocial(body.socialLinks) }),
          // Private fields (#249).
          ...(body.standContacts !== undefined && { standContacts: cleanStandContacts(body.standContacts) }),
          ...(body.comKitReceived !== undefined && { comKitReceived: body.comKitReceived }),
          ...(body.comKitLogoWebUrl !== undefined && { comKitLogoWebUrl: body.comKitLogoWebUrl || null }),
          ...(body.comKitLogoPrintUrl !== undefined && { comKitLogoPrintUrl: body.comKitLogoPrintUrl || null }),
          ...(body.comKitCharterUrl !== undefined && { comKitCharterUrl: body.comKitCharterUrl || null }),
          ...(body.comKitNotes !== undefined && { comKitNotes: body.comKitNotes || null }),
          // Promo-idea fields (#252): silently ignored for tiers that don't
          // allow them, so the field can't be set by tampering with the payload.
          ...(entity.tier.allowsPromoIdeas && body.platinumPromoIdea !== undefined && {
            platinumPromoIdea: body.platinumPromoIdea || null,
          }),
          ...(entity.tier.allowsPromoIdeas && body.platinumCoBuildIdea !== undefined && {
            platinumCoBuildIdea: body.platinumCoBuildIdea || null,
          }),
        },
      });
      // Only public-facing changes need cache revalidation; a private-only
      // save (com kit, stand contacts) changes nothing on the public pages.
      const touchesPublic =
        body.descriptionFr !== undefined ||
        body.descriptionEn !== undefined ||
        body.websiteUrl !== undefined ||
        body.logoUrl !== undefined ||
        body.socialLinks !== undefined;
      if (touchesPublic) revalidateSponsors();
    }

    return { saved: true };
  });

  // PUT /api/edit/:token/talks/:talkId — a speaker edits the wording of one of
  // their sessions (#260), and only if the organizers opened that talk to
  // editing (#289). Format/level/language, programming, status and the speaker
  // list are NOT editable here. Changes publish immediately (direct
  // publication) and notify the CFP address.
  app.put<{ Params: { token: string; talkId: string }; Body: TalkEditBody }>(
    "/edit/:token/talks/:talkId",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        params: {
          type: "object",
          required: ["token", "talkId"],
          properties: { token: { type: "string" }, talkId: { type: "string", pattern: "^[0-9]+$" } },
        },
        body: talkBodySchema,
      },
      // Runs before Ajv strips unknown keys, so a client sending `room` or
      // `publicationStatus` is refused, not silently ignored (#223 pattern).
      preValidation: async (request, reply) => {
        const body = request.body;
        if (!body || typeof body !== "object") return;
        const forbidden = findForbiddenTalkKey(body as Record<string, unknown>);
        if (forbidden) {
          return reply.code(400).send({ error: "forbidden_field", field: forbidden });
        }
      },
    },
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved) return reply.code(404).send({ error: "invalid_token" });

      // Only a speaker token carries talks; a sponsor token has no session to edit.
      if (resolved.kind !== "speaker") return reply.code(404).send({ error: "invalid_token" });

      const { entity } = resolved;
      const blocked = editingBlockedReason(entity);
      if (blocked) return reply.code(403).send({ error: blocked });

      // Ownership: the token may only edit a talk it actually presents. The
      // talks list already comes filtered to this speaker's published sessions,
      // so a talkId absent from it is either someone else's or not editable.
      const talkId = Number(request.params.talkId);
      const talk = entity.talks.find((t) => t.id === talkId);
      if (!talk) return reply.code(404).send({ error: "talk_not_found" });

      // Editing is opt-in per talk (#289): the organizers open it one session at
      // a time. 403 rather than 404 — the talk exists and belongs to the caller,
      // it is simply closed to edits, and the UI says so.
      if (!talk.isSpeakerEditable) return reply.code(403).send({ error: "talk_not_editable" });

      const body = request.body;
      if (hasBlankTitle(body)) return reply.code(400).send({ error: "empty_title" });

      // A field absent from the body is left untouched.
      await prisma.talk.update({
        where: { id: talk.id },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() }),
          ...(body.description !== undefined && { description: body.description }),
        },
      });

      // Direct publication: the change is public right away.
      revalidateConferences();

      // Notify the organizers (best-effort: a mail failure must not fail the
      // save the speaker just made).
      try {
        await notifyTalkEdited(entity.name, { id: talk.id, title: body.title?.trim() || talk.title });
      } catch (err) {
        request.log.error("Failed to send talk-edit notification: %s", String(err));
      }

      return { saved: true };
    },
  );

  // --- Job offers (#251): a sponsor manages the offers we relay for them,
  // from the same link, capped by its level. Direct publication + revalidation.
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
  };

  // POST /api/edit/:token/job-offers — create an offer, enforcing the quota.
  app.post<{ Params: { token: string }; Body: { title: string; descriptionFr?: string; descriptionEn?: string; url: string } }>(
    "/edit/:token/job-offers",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        params: { type: "object", required: ["token"], properties: { token: { type: "string" } } },
        body: jobOfferBodySchema,
      },
    },
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved || resolved.kind !== "sponsor") return reply.code(404).send({ error: "invalid_token" });
      const { entity } = resolved;
      const blocked = editingBlockedReason(entity);
      if (blocked) return reply.code(403).send({ error: blocked });

      const { title, url } = request.body;
      if (!title.trim()) return reply.code(400).send({ error: "empty_title" });
      if (!isSafeUrl(url)) return reply.code(400).send({ error: "invalid_url", field: "url" });

      // Quota is per tier (#251). Count what's already there; a lowered tier
      // keeps existing offers but blocks new ones beyond the new cap.
      const quota = entity.tier.jobOfferQuota;
      if (entity.jobOffers.length >= quota) {
        return reply.code(409).send({ error: "quota_reached", quota });
      }

      const offer = await prisma.sponsorJobOffer.create({
        data: {
          sponsorId: entity.id,
          title: title.trim(),
          descriptionFr: sanitizeRichHtml(request.body.descriptionFr),
          descriptionEn: sanitizeRichHtml(request.body.descriptionEn),
          url: url.trim(),
        },
      });
      revalidateSponsors();
      revalidateJobOffers();
      return reply.code(201).send({
        id: offer.id,
        title: offer.title,
        descriptionFr: offer.descriptionFr,
        descriptionEn: offer.descriptionEn,
        url: offer.url,
      });
    },
  );

  // PUT /api/edit/:token/job-offers/:offerId — edit one of the sponsor's offers.
  app.put<{ Params: { token: string; offerId: string }; Body: { title?: string; descriptionFr?: string; descriptionEn?: string; url?: string } }>(
    "/edit/:token/job-offers/:offerId",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        params: {
          type: "object",
          required: ["token", "offerId"],
          properties: { token: { type: "string" }, offerId: { type: "string", pattern: "^[0-9]+$" } },
        },
        body: { type: "object", additionalProperties: false, properties: jobOfferBodySchema.properties },
      },
    },
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved || resolved.kind !== "sponsor") return reply.code(404).send({ error: "invalid_token" });
      const { entity } = resolved;
      const blocked = editingBlockedReason(entity);
      if (blocked) return reply.code(403).send({ error: blocked });

      // Ownership: only offers already attached to this sponsor.
      const offerId = Number(request.params.offerId);
      const offer = entity.jobOffers.find((o) => o.id === offerId);
      if (!offer) return reply.code(404).send({ error: "offer_not_found" });

      const body = request.body;
      if (body.title !== undefined && !body.title.trim()) return reply.code(400).send({ error: "empty_title" });
      if (body.url !== undefined && !isSafeUrl(body.url)) return reply.code(400).send({ error: "invalid_url", field: "url" });

      await prisma.sponsorJobOffer.update({
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
      return { saved: true };
    },
  );

  // DELETE /api/edit/:token/job-offers/:offerId — remove an offer.
  app.delete<{ Params: { token: string; offerId: string } }>(
    "/edit/:token/job-offers/:offerId",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        params: {
          type: "object",
          required: ["token", "offerId"],
          properties: { token: { type: "string" }, offerId: { type: "string", pattern: "^[0-9]+$" } },
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved || resolved.kind !== "sponsor") return reply.code(404).send({ error: "invalid_token" });
      const { entity } = resolved;
      const blocked = editingBlockedReason(entity);
      if (blocked) return reply.code(403).send({ error: blocked });

      const offerId = Number(request.params.offerId);
      const offer = entity.jobOffers.find((o) => o.id === offerId);
      if (!offer) return reply.code(404).send({ error: "offer_not_found" });

      await prisma.sponsorJobOffer.delete({ where: { id: offer.id } });
      revalidateSponsors();
      revalidateJobOffers();
      return reply.code(204).send();
    },
  );

  // POST /api/edit/:token/upload — upload a logo (sponsor) or photo (speaker)
  // straight from the recipient's device (#241). Gated exactly like the edit
  // endpoints: an unusable link (locked/frozen/expired) cannot upload either.
  // Returns the stored image URL; the caller then saves it via PUT.
  app.post<{ Params: { token: string } }>("/edit/:token/upload", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: { params: { type: "object", required: ["token"], properties: { token: { type: "string" } } } },
  }, async (request, reply) => {
    const resolved = await resolveToken(request.params.token);
    if (!resolved) return reply.code(404).send({ error: "invalid_token" });
    const blocked = editingBlockedReason(resolved.entity);
    if (blocked) return reply.code(403).send({ error: blocked });

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
