// What a sponsor looked like on a given edition (#375).
//
// #129 made Sponsor a company identity shared across editions, which moved the
// logo off the year it belonged to: a 2027 logo change would repaint the 2026
// wall. The tier had the same problem from the other side — it is bought per
// edition, but its name, colour and logo scale live in a shared catalogue that
// renaming "Gold" mutates for every past edition at once.
//
// So the participation stores what was displayed. Both readers below prefer
// that frozen value and fall back to the live one when it is null, which is
// what a participation created before this change looks like.

interface FrozenLogo {
  logoUrl: string | null;
}

interface LiveTier {
  key: string;
  rank: number;
  nameFr: string;
  nameEn: string;
  logoScale: number;
  color: string;
}

interface FrozenTier {
  tierNameFr: string | null;
  tierNameEn: string | null;
  tierColor: string | null;
  tierLogoScale: number | null;
}

// The logo this edition showed, falling back to the company's current one.
export function archivedLogoUrl(
  participation: FrozenLogo,
  sponsor: { logoUrl: string | null },
): string | null {
  return participation.logoUrl ?? sponsor.logoUrl;
}

// The tier as this edition displayed it. `key` and `rank` are never frozen:
// they drive grouping and ordering, not appearance, and a renamed tier is
// still the same offer.
export function archivedTier(participation: FrozenTier & { tier: LiveTier }) {
  const { tier } = participation;
  return {
    key: tier.key,
    rank: tier.rank,
    nameFr: participation.tierNameFr ?? tier.nameFr,
    nameEn: participation.tierNameEn ?? tier.nameEn,
    logoScale: participation.tierLogoScale ?? tier.logoScale,
    color: participation.tierColor ?? tier.color,
  };
}
