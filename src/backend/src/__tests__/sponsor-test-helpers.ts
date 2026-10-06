import { prisma } from "../lib/prisma.js";

// Resolve a seeded SponsorTier id from its stable key (#317). The tier is bought
// per edition since #129, so it is set on the participation, not the company.
export async function tierIdByKey(key: string): Promise<number> {
  const tier = await prisma.sponsorTier.findFirstOrThrow({ where: { key } });
  return tier.id;
}

// A sponsor fixture on the identity/participation model (#129). Callers still
// pass editionId/tierId/publicationStatus flat — those are what a test cares
// about — and this factory files them into the participation.
export interface SponsorFixture {
  name: string;
  slug: string;
  editionId: number;
  tierId: number;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  logoUrl?: string | null;
  websiteUrl?: string | null;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  socialLinks?: string | null;
  contactEmail?: string | null;
  standContacts?: string | null;
  locale?: string;
}

// A sponsor with one participation, ready for the tests to attach contacts.
export async function createSponsorFixture(data: SponsorFixture) {
  const { editionId, tierId, publicationStatus, ...identity } = data;
  return prisma.sponsor.create({
    data: {
      ...identity,
      editions: {
        create: [{ editionId, tierId, publicationStatus: publicationStatus ?? "DRAFT" }],
      },
    },
  });
}
