// Compatibility shim for the sponsoring refactor (#317).
//
// Sponsor.level (enum) became a FK to SponsorTier. The public /api/sponsors
// response and the /api/edit private block still expose a legacy `level` string
// so the front (sponsor wall colours, "large" card, i18n keys sponsors.level.*)
// keeps working untouched until #321 rebinds it to the tier model. This mapping
// — and every caller of it — is deliberately throwaway: it disappears with #321.

const KEY_TO_LEGACY_LEVEL: Record<string, string> = {
  platinum: "PLATINUM",
  gold: "GOLD",
  discovery: "SILVER",
  "soutien-communautes": "SOUTIEN",
};

// Map a tier key back to the historical SponsorLevel enum value. Unknown keys
// fall back to SOUTIEN (the lowest tier), matching the migration's safety net.
export function tierKeyToLegacyLevel(key: string): string {
  return KEY_TO_LEGACY_LEVEL[key] ?? "SOUTIEN";
}
