import { isSafeUrl, sanitizeRichHtml } from "./sanitize.js";

// Job-offer business rules (#251).
//
// The per-tier quota (how many offers a sponsor may publish) moved onto
// SponsorTier.jobOfferQuota with #317 — read it from the sponsor's tier instead
// of a hard-coded table.

// Offers stay visible until one month after the event. We anchor on the
// edition's end date (fall back to its start date), so the cut-off follows the
// real event, not the calendar. A null date means the event isn't scheduled
// yet — nothing to hide.
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function offersVisibilityCutoff(
  edition: { startDate: Date | null; endDate: Date | null },
): Date | null {
  const anchor = edition.endDate ?? edition.startDate;
  if (!anchor) return null;
  return new Date(anchor.getTime() + ONE_MONTH_MS);
}

// True while the sponsor's offers should still be shown publicly.
export function areOffersVisible(
  edition: { startDate: Date | null; endDate: Date | null },
  now: Date = new Date(),
): boolean {
  const cutoff = offersVisibilityCutoff(edition);
  if (!cutoff) return true;
  return now.getTime() <= cutoff.getTime();
}

// --- Writing an offer -----------------------------------------------------
//
// Shared by the sponsor space and the back-office (#609): the team may create
// and edit offers too, and the two doors must accept exactly the same payload.
// Same bounds as the edit link (#223): rendered on public pages, so the body is
// an allow-list of known keys and lengths.

// The frontend gauge mirrors DESCRIPTION_MAX (src/frontend/src/lib/sponsor-text-limit.ts, #610).
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5_000;
const URL_MAX = 2_048;

export interface JobOfferBody {
  title: string;
  descriptionFr?: string;
  descriptionEn?: string;
  url: string;
}

export const jobOfferBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "url"],
  properties: {
    title: { type: "string", maxLength: TITLE_MAX },
    descriptionFr: { type: "string", maxLength: DESCRIPTION_MAX },
    descriptionEn: { type: "string", maxLength: DESCRIPTION_MAX },
    url: { type: "string", maxLength: URL_MAX },
  },
} as const;

export const jobOfferPatchSchema = {
  type: "object",
  additionalProperties: false,
  properties: jobOfferBodySchema.properties,
} as const;

// The error a client shows, or null when the fields it carries are writable.
// Only checks what is present, so a partial update goes through the same rule.
export function jobOfferBodyError(
  body: Partial<JobOfferBody>,
): { error: "empty_title" } | { error: "invalid_url"; field: "url" } | null {
  if (body.title !== undefined && !body.title.trim()) return { error: "empty_title" };
  if (body.url !== undefined && !isSafeUrl(body.url)) return { error: "invalid_url", field: "url" };
  return null;
}

export function newJobOfferData(body: JobOfferBody) {
  return {
    title: body.title.trim(),
    descriptionFr: sanitizeRichHtml(body.descriptionFr),
    descriptionEn: sanitizeRichHtml(body.descriptionEn),
    url: body.url.trim(),
  };
}

// Prisma data for the fields present in the body, trimmed and sanitized.
export function jobOfferData(body: Partial<JobOfferBody>) {
  return {
    ...(body.title !== undefined && { title: body.title.trim() }),
    ...(body.descriptionFr !== undefined && { descriptionFr: sanitizeRichHtml(body.descriptionFr) }),
    ...(body.descriptionEn !== undefined && { descriptionEn: sanitizeRichHtml(body.descriptionEn) }),
    ...(body.url !== undefined && { url: body.url.trim() }),
  };
}
