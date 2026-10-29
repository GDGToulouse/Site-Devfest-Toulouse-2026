import { z } from "zod";

import type { BadgeType } from "../generated/prisma/client.js";

// The badges' look (#639, #749): one background and one colour per type of
// badge, the same layout inside the light zone for all. The QR code holds
// the ticket's code, which Billetweb's badge app (given to the sponsors)
// reads, or a vCard. Stored on the edition; the built-in design fills the gaps.

export const BADGE_TYPES = ["PARTICIPANT", "SPEAKER", "VOLUNTEER", "CONTRACTOR"] as const satisfies readonly BadgeType[];

export const BADGE_TYPE_NAMES: Record<BadgeType, string> = {
  PARTICIPANT: "Participant",
  SPEAKER: "Speaker",
  VOLUNTEER: "Bénévole",
  CONTRACTOR: "Prestataire",
};

/** The working design's purple (2026): the text and the QR code. */
export const DEFAULT_BADGE_COLOR = "#683D91";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// A file of the site's media library: the only place a background is read from.
const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|svg|pdf)$/i;

const typeDesignSchema = z.object({
  background: z.string().regex(UPLOAD_PATH).nullable(),
  color: z.string().regex(HEX_COLOR),
});

export const badgeDesignSchema = z.object({
  qrContent: z.enum(["TICKET", "VCARD"]),
  types: z.object({
    PARTICIPANT: typeDesignSchema,
    SPEAKER: typeDesignSchema,
    VOLUNTEER: typeDesignSchema,
    CONTRACTOR: typeDesignSchema,
  }),
});

export type BadgeDesign = z.infer<typeof badgeDesignSchema>;
export type TypeDesign = z.infer<typeof typeDesignSchema>;

export const DEFAULT_BADGE_DESIGN: BadgeDesign = {
  qrContent: "TICKET",
  types: Object.fromEntries(
    BADGE_TYPES.map((type) => [type, { background: null, color: DEFAULT_BADGE_COLOR }]),
  ) as BadgeDesign["types"],
};

/** The stored design, or the built-in one where it is missing or unreadable. */
export function readBadgeDesign(stored: unknown): BadgeDesign {
  const parsed = badgeDesignSchema.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_BADGE_DESIGN;
}

/**
 * The badge a ticket prints. Through the counters, sponsors' tickets
 * included: a participant. Outside: the tier's type, else a guess from its
 * name, so a forgotten setting still prints something sensible.
 */
export function badgeTypeOf(tier: { isOutsideFlow: boolean; badgeType: BadgeType | null; nameFr: string } | null): BadgeType {
  if (!tier || !tier.isOutsideFlow) return "PARTICIPANT";
  if (tier.badgeType) return tier.badgeType;
  const name = tier.nameFr.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/benevole|staff|orga/.test(name)) return "VOLUNTEER";
  if (/prestataire|traiteur|technique/.test(name)) return "CONTRACTOR";
  return "SPEAKER";
}
