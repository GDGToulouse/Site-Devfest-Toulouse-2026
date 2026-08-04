import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";

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

// The published sponsor wall of one edition, as that edition displayed it.
// Serves both /api/sponsors (featured edition) and /api/editions/:year/sponsors
// (#370) — same payload, so the public page and the archive grid share one
// component and one type; only the edition they resolve differs.
export async function getEditionSponsorWall(editionId: number) {
  const links = await prisma.editionSponsor.findMany({
    where: { editionId, publicationStatus: "PUBLISHED", sponsor: notDeleted },
    include: {
      sponsor: { select: { id: true, slug: true, name: true, logoUrl: true, websiteUrl: true } },
      tier: { select: { key: true, rank: true, nameFr: true, nameEn: true, logoScale: true, color: true } },
    },
  });

  return links
    .map((link) => ({
      id: link.sponsor.id,
      slug: link.sponsor.slug,
      name: link.sponsor.name,
      logoUrl: archivedLogoUrl(link, link.sponsor),
      tier: archivedTier(link),
      websiteUrl: link.sponsor.websiteUrl,
    }))
    // Higher rank = more prominent (RG-221), so sort descending.
    .sort((a, b) => (b.tier.rank - a.tier.rank) || a.name.localeCompare(b.name));
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
