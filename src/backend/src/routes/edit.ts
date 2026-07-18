import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { isEditingFrozen, isEditTokenExpired } from "../lib/edit-token.js";
import { normalizeLocale } from "../lib/edit-link-email.js";
import { isSafeUrl } from "../lib/sanitize.js";
import {
  revalidateConferences,
  revalidateSpeakers,
  revalidateSponsors,
} from "../lib/revalidate.js";
import { storeImageBuffer } from "../lib/image-store.js";
import { sendEmail } from "../lib/email.js";
import { getCfpNotificationEmail } from "../lib/cfp-settings.js";
import { getSponsorContactRecipients } from "../lib/sponsor-contact.js";

// This is the only unauthenticated endpoint that writes to the database and
// whose content is rendered on public pages, so everything below is an
// allowlist: known fields, bounded lengths, http(s) URLs only (#223).
const TEXT_MAX = 5_000;
const SHORT_MAX = 200;
const URL_MAX = 2_048;

// Logo/photo upload through a token (#241). Unlike the admin uploader, this
// endpoint is unauthenticated (the token is the only credential), so it is
// deliberately narrower: raster images only — SVG is excluded because it can
// carry inline scripts and /uploads/ serves files with their native
// content-type, which would let a submitted logo run JS in a visitor's browser.
const UPLOAD_MAX_SIZE = 5_000_000; // 5 MB
const UPLOAD_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

// Talk fields a speaker may edit from the link (#260): descriptive content
// only. Programming (room, slot, publication status), slug and the speaker
// list stay with the organizers. Titles are single-line, descriptions long.
const TITLE_MAX = 300;
const TALK_FORMATS = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"] as const;
const TALK_LEVELS = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"] as const;
const TALK_LANGUAGES = ["fr", "en"] as const;

const talkBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    titleFr: { type: "string", maxLength: TITLE_MAX },
    titleEn: { type: "string", maxLength: TITLE_MAX },
    descriptionFr: { type: "string", maxLength: TEXT_MAX },
    descriptionEn: { type: "string", maxLength: TEXT_MAX },
    format: { type: "string", enum: [...TALK_FORMATS] },
    // level may be cleared ("" -> "Tous niveaux"), so an empty string is valid.
    level: { type: "string", enum: ["", ...TALK_LEVELS] },
    language: { type: "string", enum: [...TALK_LANGUAGES] },
  },
};

const TALK_ALLOWED_FIELDS = Object.keys(talkBodySchema.properties);

interface TalkEditBody {
  titleFr?: string;
  titleEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  format?: (typeof TALK_FORMATS)[number];
  level?: "" | (typeof TALK_LEVELS)[number];
  language?: (typeof TALK_LANGUAGES)[number];
}

// A title is the only field that cannot be blank: it's rendered as the session
// heading and used to derive the slug. Descriptions and level may be cleared.
function findBlankTitle(body: TalkEditBody): string | null {
  for (const field of ["titleFr", "titleEn"] as const) {
    if (body[field] !== undefined && !body[field]!.trim()) return field;
  }
  return null;
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
      edition: { select: { startDate: true } },
      // Sessions the speaker can edit from the link (#260). Only published ones
      // are surfaced; the descriptive content is editable, the programming
      // (room/slot/status) and the speaker list are not.
      talks: {
        where: { publicationStatus: "PUBLISHED" },
        select: {
          id: true,
          slug: true,
          titleFr: true,
          titleEn: true,
          descriptionFr: true,
          descriptionEn: true,
          format: true,
          level: true,
          language: true,
        },
        orderBy: { titleFr: "asc" },
      },
    },
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
  talk: { id: number; titleFr: string },
): Promise<void> {
  const to = await getCfpNotificationEmail();
  const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const adminUrl = `${baseUrl}/admin/talks/${talk.id}`;

  const subject = `Conférence modifiée par un·e speaker — ${talk.titleFr}`;
  const text = [
    `${speakerName} a mis à jour sa conférence « ${talk.titleFr} ».`,
    "",
    `Les modifications sont déjà en ligne (publication directe).`,
    `Fiche admin : ${adminUrl}`,
  ].join("\n");
  const html = `
    <h3>Conférence modifiée par un·e speaker</h3>
    <p><strong>${escapeHtml(speakerName)}</strong> a mis à jour sa conférence
    « ${escapeHtml(talk.titleFr)} ».</p>
    <p>Les modifications sont déjà en ligne (publication directe).</p>
    <p><a href="${adminUrl}">Voir la fiche dans l'admin</a></p>
  `;

  await sendEmail({ to: [to], subject, text, html });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
        level: entity.level,
        standContacts: parseStandContacts(entity.standContacts),
        comKitReceived: entity.comKitReceived,
        comKitLogoWebUrl: entity.comKitLogoWebUrl,
        comKitLogoPrintUrl: entity.comKitLogoPrintUrl,
        comKitCharterUrl: entity.comKitCharterUrl,
        comKitNotes: entity.comKitNotes,
        // Platinum-only ideas (#252). Sent for every sponsor; the UI shows the
        // fields only when level === PLATINUM.
        platinumPromoIdea: entity.platinumPromoIdea,
        platinumCoBuildIdea: entity.platinumCoBuildIdea,
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
          // Private fields (#249).
          ...(body.standContacts !== undefined && { standContacts: cleanStandContacts(body.standContacts) }),
          ...(body.comKitReceived !== undefined && { comKitReceived: body.comKitReceived }),
          ...(body.comKitLogoWebUrl !== undefined && { comKitLogoWebUrl: body.comKitLogoWebUrl || null }),
          ...(body.comKitLogoPrintUrl !== undefined && { comKitLogoPrintUrl: body.comKitLogoPrintUrl || null }),
          ...(body.comKitCharterUrl !== undefined && { comKitCharterUrl: body.comKitCharterUrl || null }),
          ...(body.comKitNotes !== undefined && { comKitNotes: body.comKitNotes || null }),
          // Platinum-only ideas (#252): silently ignored for non-Platinum
          // sponsors, so the field can't be set by tampering with the payload.
          ...(entity.level === "PLATINUM" && body.platinumPromoIdea !== undefined && {
            platinumPromoIdea: body.platinumPromoIdea || null,
          }),
          ...(entity.level === "PLATINUM" && body.platinumCoBuildIdea !== undefined && {
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

  // PUT /api/edit/:token/talks/:talkId — a speaker edits the descriptive
  // content of one of their sessions (#260). Programming, status and the
  // speaker list are NOT editable here. Changes publish immediately (direct
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

      const body = request.body;
      const blankTitle = findBlankTitle(body);
      if (blankTitle) return reply.code(400).send({ error: "empty_title", field: blankTitle });

      // A field absent from the body is left untouched; level accepts "" to
      // clear it back to "Tous niveaux".
      await prisma.talk.update({
        where: { id: talk.id },
        data: {
          ...(body.titleFr !== undefined && { titleFr: body.titleFr.trim() }),
          ...(body.titleEn !== undefined && { titleEn: body.titleEn.trim() }),
          ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr }),
          ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn }),
          ...(body.format !== undefined && { format: body.format }),
          ...(body.level !== undefined && { level: body.level || null }),
          ...(body.language !== undefined && { language: body.language }),
        },
      });

      // Direct publication: the change is public right away.
      revalidateConferences();

      // Notify the organizers (best-effort: a mail failure must not fail the
      // save the speaker just made).
      try {
        await notifyTalkEdited(entity.name, { id: talk.id, titleFr: body.titleFr?.trim() || talk.titleFr });
      } catch (err) {
        request.log.error("Failed to send talk-edit notification: %s", String(err));
      }

      return { saved: true };
    },
  );

  // POST /api/edit/:token/com-kit-email — a sponsor asks the organizers to
  // collect com-kit complements that don't fit as links (#249). We don't accept
  // attachments here (the token is unauthenticated); instead we email the
  // sponsoring team with Reply-To set to the sponsor, so they can reply and the
  // sponsor answers with the files attached.
  app.post<{ Params: { token: string }; Body: { message?: string } }>(
    "/edit/:token/com-kit-email",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        params: { type: "object", required: ["token"], properties: { token: { type: "string" } } },
        body: {
          type: "object",
          additionalProperties: false,
          properties: { message: { type: "string", maxLength: TEXT_MAX } },
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved || resolved.kind !== "sponsor") return reply.code(404).send({ error: "invalid_token" });

      const { entity } = resolved;
      const blocked = editingBlockedReason(entity);
      if (blocked) return reply.code(403).send({ error: blocked });

      const recipients = await getSponsorContactRecipients();
      const message = request.body?.message?.trim();

      const subject = `Compléments kit de com — ${entity.name}`;
      const text = [
        `${entity.name} souhaite transmettre des compléments pour son kit de communication.`,
        message ? `\nMessage :\n${message}` : "",
        entity.contactEmail
          ? `\nRépondez à cet email pour demander les pièces jointes (Reply-To : ${entity.contactEmail}).`
          : "\nRépondez à cet email pour demander les pièces jointes.",
      ].join("\n");
      const html = `
        <h3>Compléments kit de com — ${escapeHtml(entity.name)}</h3>
        <p><strong>${escapeHtml(entity.name)}</strong> souhaite transmettre des compléments
        pour son kit de communication.</p>
        ${message ? `<p><strong>Message :</strong><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : ""}
        <p>Répondez à cet email pour demander les pièces jointes.</p>
      `;

      try {
        await sendEmail({
          to: recipients,
          subject,
          text,
          html,
          ...(entity.contactEmail ? { replyTo: entity.contactEmail } : {}),
        });
      } catch (err) {
        request.log.error("Failed to send com-kit email: %s", String(err));
        return reply.code(502).send({ error: "email_failed" });
      }

      return { sent: true };
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

    const url = await storeImageBuffer(buffer, data.mimetype);
    return { url };
  });
}
