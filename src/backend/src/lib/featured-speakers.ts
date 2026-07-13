import { prisma } from "./prisma.js";
import { revalidateSpeakers } from "./revalidate.js";
import { getFeaturedEdition } from "../routes/editions.js";

// How many speakers the home page highlights. Matches the `take` used by
// GET /api/speakers/featured, so the rotation fills exactly what is displayed.
export const FEATURED_SPEAKERS_COUNT = 8;

export interface RotationResult {
  edition: number | null;
  featured: string[];
}

/**
 * Pick FEATURED_SPEAKERS_COUNT published speakers at random in the current
 * edition and make them the featured ones, clearing the previous selection
 * (#214). Fewer speakers than the target simply means all of them are featured.
 *
 * This overwrites any manual pick made in the admin — by design: the rotation
 * is the single source of truth for who is highlighted.
 */
export async function rotateFeaturedSpeakers(): Promise<RotationResult> {
  const edition = await getFeaturedEdition();
  if (!edition) return { edition: null, featured: [] };

  // Draw in the database rather than loading every speaker into memory.
  const picked = await prisma.$queryRaw<{ id: number; name: string }[]>`
    SELECT id, name
    FROM "Speaker"
    WHERE "editionId" = ${edition.id}
      AND "publicationStatus" = 'PUBLISHED'
    ORDER BY random()
    LIMIT ${FEATURED_SPEAKERS_COUNT}
  `;

  const ids = picked.map((s) => s.id);

  // Clear then set, in one transaction: a half-applied rotation would leave the
  // home page with the wrong line-up.
  await prisma.$transaction([
    prisma.speaker.updateMany({
      where: { editionId: edition.id, isFeatured: true },
      data: { isFeatured: false },
    }),
    ...(ids.length > 0
      ? [
          prisma.speaker.updateMany({
            where: { id: { in: ids } },
            data: { isFeatured: true },
          }),
        ]
      : []),
  ]);

  // The home page caches for an hour, so without this the new line-up would
  // only surface up to an hour later.
  await revalidateSpeakers();

  return { edition: edition.year, featured: picked.map((s) => s.name) };
}
