import { z } from "zod";

import type { BadgeType } from "../generated/prisma/client.js";

// The badges' look (#639, #749, #774): per type of badge a front background, a
// back background and a text colour, plus the QR code's colour and content.
// The QR code holds the ticket's code, which Billetweb's badge app (given to
// the sponsors) reads, or a vCard. Stored on the edition; the built-in design
// fills the gaps.

export const BADGE_TYPES = [
  "PARTICIPANT",
  "SPONSOR",
  "STAFF",
  "SPEAKER",
  "VOLUNTEER",
  "CONTRACTOR",
] as const satisfies readonly BadgeType[];

// Through the counters: numbered, stored in bins. The others have a dedicated
// desk and no number (RG-ARR-14).
export const COUNTER_BADGE_TYPES: readonly BadgeType[] = ["PARTICIPANT", "SPONSOR"];
export const OUTSIDE_BADGE_TYPES: readonly BadgeType[] = ["STAFF", "SPEAKER", "VOLUNTEER", "CONTRACTOR"];

export const BADGE_TYPE_NAMES: Record<BadgeType, string> = {
  PARTICIPANT: "Participant",
  SPONSOR: "Sponsor",
  STAFF: "Staff",
  SPEAKER: "Speaker",
  VOLUNTEER: "Bénévole",
  CONTRACTOR: "Prestataire",
};

/** Whether a tier of this flow may print that badge: the pairing the admin cannot break. */
export function isBadgeTypeAllowed(isOutsideFlow: boolean, type: BadgeType): boolean {
  return (isOutsideFlow ? OUTSIDE_BADGE_TYPES : COUNTER_BADGE_TYPES).includes(type);
}

/** The text is white on the V3 backgrounds. */
export const DEFAULT_BADGE_COLOR = "#FFFFFF";
/** The dark purple text of the 2026 working design: what a stored design of that time holds. */
const LEGACY_BADGE_COLOR = "#683D91";
/** The participant band's violet, sampled from the V3 background: the QR code, readable on its light square. */
export const DEFAULT_QR_COLOR = "#5F3B9F";

// The built-in backgrounds (#774), one front and one back per type.
export const builtInBackground = (type: BadgeType, side: "front" | "back") => `badges/${side}-${type.toLowerCase()}.pdf`;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// A file of the site's media library: the only place a background is read from.
const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|svg|pdf)$/i;

const backgroundSchema = z.string().regex(UPLOAD_PATH).nullable();
const colorSchema = z.string().regex(HEX_COLOR);

const typeDesignSchema = z.object({
  background: backgroundSchema,
  backBackground: backgroundSchema,
  color: colorSchema,
});

export const badgeDesignSchema = z.object({
  qrContent: z.enum(["TICKET", "VCARD"]),
  qrColor: colorSchema,
  types: z.object(Object.fromEntries(BADGE_TYPES.map((type) => [type, typeDesignSchema])) as Record<BadgeType, typeof typeDesignSchema>),
});

export type BadgeDesign = z.infer<typeof badgeDesignSchema>;
export type TypeDesign = z.infer<typeof typeDesignSchema>;

export const DEFAULT_BADGE_DESIGN: BadgeDesign = {
  qrContent: "TICKET",
  qrColor: DEFAULT_QR_COLOR,
  types: Object.fromEntries(
    BADGE_TYPES.map((type) => [type, { background: null, backBackground: null, color: DEFAULT_BADGE_COLOR }]),
  ) as BadgeDesign["types"],
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// A field's stored value when valid, else the built-in one: a design stored
// before V3 has no back, no QR colour and no sponsor or staff type.
const validOr = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
};

/**
 * The stored design, completed with the built-in one where a value is missing
 * or unreadable. The 2026 working design's dark text colour, which the V3
 * layout would make unreadable on its dark ribbon, is reset to white.
 */
export function readBadgeDesign(stored: unknown): BadgeDesign {
  const raw = asRecord(stored);
  const rawTypes = asRecord(raw.types);
  const types = Object.fromEntries(
    BADGE_TYPES.map((type) => {
      const own = asRecord(rawTypes[type]);
      const color = validOr(colorSchema, own.color, DEFAULT_BADGE_COLOR);
      return [
        type,
        {
          background: validOr(backgroundSchema, own.background, null),
          backBackground: validOr(backgroundSchema, own.backBackground, null),
          color: color.toUpperCase() === LEGACY_BADGE_COLOR ? DEFAULT_BADGE_COLOR : color,
        },
      ];
    }),
  ) as BadgeDesign["types"];
  return {
    qrContent: validOr(badgeDesignSchema.shape.qrContent, raw.qrContent, DEFAULT_BADGE_DESIGN.qrContent),
    qrColor: validOr(colorSchema, raw.qrColor, DEFAULT_QR_COLOR),
    types,
  };
}

/**
 * The badge a ticket prints: the tier's own choice when its flow allows it,
 * else a guess from its name (Sponsor, Staff…), so a forgotten setting still
 * prints something sensible.
 */
export function badgeTypeOf(tier: { isOutsideFlow: boolean; badgeType: BadgeType | null; nameFr: string } | null): BadgeType {
  if (!tier) return "PARTICIPANT";
  if (tier.badgeType && isBadgeTypeAllowed(tier.isOutsideFlow, tier.badgeType)) return tier.badgeType;
  const name = tier.nameFr.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (!tier.isOutsideFlow) return /sponsor|partenaire/.test(name) ? "SPONSOR" : "PARTICIPANT";
  if (/staff/.test(name)) return "STAFF";
  if (/benevole|orga/.test(name)) return "VOLUNTEER";
  if (/prestataire|traiteur|technique/.test(name)) return "CONTRACTOR";
  return "SPEAKER";
}
