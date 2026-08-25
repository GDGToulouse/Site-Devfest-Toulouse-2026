import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { isEditingFrozen, isEditTokenExpired, generateInvitationToken } from "../lib/edit-token.js";
import { resolveInitialAccessRole } from "../lib/sponsor-invitation.js";
import { normalizeLocale } from "../lib/edit-link-email.js";
import { isSafeUrl } from "../lib/sanitize.js";
import {
  revalidateConferences,
  revalidateSpeakers,
  revalidateSpeaker,
  revalidateTalk,
} from "../lib/revalidate.js";
import { storeImageBuffer, UnsafeSvgError } from "../lib/image-store.js";
import { rememberOriginalName } from "../lib/file-metadata.js";
import { sendEmail, escapeHtml } from "../lib/email.js";
import { emailButton, emailHeading } from "../lib/email-template.js";
import { getCfpNotificationEmail } from "../lib/cfp-settings.js";
import { cleanSocial } from "../lib/sponsor-write.js";

// This is the only unauthenticated endpoint that writes to the database and
// whose content is rendered on public pages, so everything below is an
// allowlist: known fields, bounded lengths, http(s) URLs only (#223).
const TEXT_MAX = 5_000;
const SHORT_MAX = 200;
const URL_MAX = 2_048;

// Photo upload through a token (#241). Raster only: SVG (#346) and PDF (#374)
// were here for the sponsor logo and com-kit charter, which now go through the
// authenticated space (#362). A speaker sends a photograph, and this endpoint
// is unauthenticated — the token is the only credential — so the narrower list
// is the right one again.
const UPLOAD_MAX_SIZE = 5_000_000; // 5 MB
const UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
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

const editBodySchema = speakerBodySchema;

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
  const value = body.photoUrl;
  if (typeof value === "string" && value.trim() && !isSafeUrl(value)) return "photoUrl";

  const social = body.socialLinks;
  if (social && typeof social === "object") {
    for (const [key, entry] of Object.entries(social as Record<string, unknown>)) {
      if (typeof entry === "string" && entry.trim() && !isSafeUrl(entry)) return `socialLinks.${key}`;
    }
  }
  return null;
}

// Resolve a modification token to the speaker who holds it. Returns null if no
// speaker carries it — the token may still be a sponsor one, which GET turns
// into an invitation rather than serving (#362).
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
          // Needed to purge the dated URL when the speaker edits their session
          // (#360) — a talk answers on two paths.
          edition: { select: { year: true } },
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

  // Sponsors no longer resolve here (#362): a company edits its page from an
  // account, not from a link anyone holding the URL can use. GET /edit/:token
  // still recognises a sponsor token — to turn it into an invitation — but
  // nothing downstream of this function serves sponsors any more.
  return null;
}

// A sponsor token still sitting in a mailbox (#362). The link no longer edits
// anything, so opening it mints the invitation that replaces it and burns the
// token: whoever holds the link was, by definition, someone we wrote to.
//
// This lives in GET only. resolveToken is called by seven handlers, some of
// them writes — converting from there would consume the token on a concurrent
// PUT, or on a browser prefetch.
type SponsorTokenConversion =
  | { outcome: "invited"; invitationToken: string; locale: string }
  | { outcome: "has_account" }
  | { outcome: "locked" }
  | null;

async function convertSponsorEditToken(token: string): Promise<SponsorTokenConversion> {
  const contact = await prisma.sponsorContact.findUnique({
    where: { editToken: token },
    include: { sponsor: { select: { id: true, name: true, locale: true, deletedAt: true } } },
  });
  if (!contact) return null;
  // A company in the bin hands out nothing, same rule as findPendingInvitation.
  if (contact.sponsor.deletedAt) return null;

  // Revoking a link is the only lever organisers have over one already sent
  // (RG-245). Letting it open an account instead would take that back.
  if (contact.editLinkLocked) return { outcome: "locked" };

  // An account already exists: nothing to mint, and the token stays untouched
  // so closing the tab and coming back still explains the situation.
  if (contact.userId) return { outcome: "has_account" };

  // An expired link converts anyway. It proves we wrote to this person, and the
  // invitation it produces carries its own, shorter deadline — refusing would
  // strand a sponsor whose only fault is having read their mail late.
  const invitationToken = generateInvitationToken();
  const promoted = await resolveInitialAccessRole(contact.sponsorId, contact.id);

  // Single use, by compare-and-swap: two clicks on the same link race here and
  // exactly one sees a row updated.
  const claimed = await prisma.sponsorContact.updateMany({
    where: { id: contact.id, editToken: token },
    data: {
      editToken: null,
      editTokenSentAt: null,
      invitationToken,
      invitationSentAt: new Date(),
      invitationAcceptedAt: null,
      ...(promoted ? { accessRole: promoted } : {}),
    },
  });
  if (claimed.count === 0) return null;

  return { outcome: "invited", invitationToken, locale: contact.sponsor.locale };
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

    if (!resolved) {
      // Not a speaker link. It may be a sponsor one, still in a mailbox from
      // before accounts existed (#362) — hand back the invitation that replaces
      // it rather than a dead end. 200, not a redirect: the client fetches this
      // endpoint, and a 302 would be followed into the JSON parser.
      const converted = await convertSponsorEditToken(request.params.token);
      if (converted?.outcome === "invited") {
        return {
          kind: "sponsor-invitation" as const,
          locale: normalizeLocale(converted.locale),
          invitationUrl: `/sponsor/invitation/${converted.invitationToken}`,
        };
      }
      if (converted?.outcome === "has_account") {
        return reply.code(409).send({ error: "already_has_account" });
      }
      if (converted?.outcome === "locked") {
        return reply.code(403).send({ error: "locked" });
      }
      // Invalid/unknown token -> 404 (RG-249 cas limite).
      return reply.code(404).send({ error: "invalid_token" });
    }

    const { kind, entity } = resolved;
    const locale = normalizeLocale(entity.locale);
    // The locale rides along even on a refusal (#224): a blocked link must
    // explain itself in the recipient's language, not in French by default.
    const blocked = editingBlockedReason(entity);
    if (blocked) return reply.code(403).send({ error: blocked, locale });

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
  });

  // PUT /api/edit/:token — save the editable fields. Name, sessions, level and
  // publication status are NOT editable here (RG-247).
  app.put<{ Params: { token: string }; Body: SpeakerEditBody }>("/edit/:token", {
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

    const { entity } = resolved;
    const blocked = editingBlockedReason(entity);
    if (blocked) return reply.code(403).send({ error: blocked });

    // The schema bounds the shape; scheme allowlisting is what stops a
    // `javascript:` URL from reaching a public href.
    const unsafeField = findUnsafeUrl(request.body as Record<string, unknown>);
    if (unsafeField) {
      return reply.code(400).send({ error: "invalid_url", field: unsafeField });
    }

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

      // Direct publication: the change is public right away — including on the
      // session's own two pages (#360), which is what the speaker will reload.
      revalidateConferences();
      revalidateTalk(talk.slug, talk.edition.year);

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
      // Keep the name the speaker's machine gave it (#378) — the stored one
      // identifies nothing once the upload screen is closed.
      await rememberOriginalName(url, data.filename);
      return { url, originalName: data.filename };
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
