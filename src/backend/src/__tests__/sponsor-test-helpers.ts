import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

// Resolve a seeded SponsorTier id from its stable key (#317). Sponsors carry a
// tierId FK now, not a level enum, so fixtures fetch the id they need here.
export async function tierIdByKey(key: string): Promise<number> {
  const tier = await prisma.sponsorTier.findFirstOrThrow({ where: { key } });
  return tier.id;
}

// Since #250 a sponsor's modification token lives on a SponsorContact, not on
// Sponsor. These helpers create a sponsor with a linked contact carrying the
// token, so tests can resolve /api/edit/:token exactly as before.

export async function createSponsorWithToken(
  data: Prisma.SponsorUncheckedCreateInput,
  token: string,
  contact?: { email?: string; sentAt?: Date; locked?: boolean },
) {
  const sponsor = await prisma.sponsor.create({ data });
  await prisma.sponsorContact.create({
    data: {
      sponsorId: sponsor.id,
      email: contact?.email ?? sponsor.contactEmail ?? "contact@example.org",
      editToken: token,
      editTokenSentAt: contact?.sentAt ?? new Date(),
      editLinkLocked: contact?.locked ?? false,
    },
  });
  return sponsor;
}
