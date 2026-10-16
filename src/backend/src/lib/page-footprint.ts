import { prisma } from "./prisma.js";
import {
  conferenceListPaths,
  editionPagePaths,
  revalidatePaths,
  speakerPagePaths,
  sponsorPagePaths,
  talkPagePaths,
} from "./revalidate.js";

/**
 * Every page that shows these speakers (#633): their own page, their talks under
 * both addresses, the employer's page and the archive page of each year they
 * took part in. Those pages filter on the published participation, so
 * publishing a speaker changes them all — purging only the speaker lists left a
 * published speaker missing from their own talk for an hour.
 *
 * Read it before a write and again after, then purge both: a rename, a change of
 * sponsor or a detached year moves the speaker off pages the later read no
 * longer reaches. Trashed talks are kept on purpose: their page must go too.
 */
export async function speakerFootprint(speakerIds: number[]): Promise<string[]> {
  if (speakerIds.length === 0) return [];
  const speakers = await prisma.speaker.findMany({
    where: { id: { in: speakerIds } },
    select: {
      slug: true,
      talks: { select: { slug: true, edition: { select: { year: true } } } },
      editions: { select: { edition: { select: { year: true } }, sponsor: { select: { slug: true } } } },
    },
  });

  const paths = new Set<string>();
  for (const speaker of speakers) {
    speakerPagePaths(speaker.slug).forEach((p) => paths.add(p));
    for (const talk of speaker.talks) talkPagePaths(talk.slug, talk.edition.year).forEach((p) => paths.add(p));
    for (const link of speaker.editions) {
      editionPagePaths(link.edition.year).forEach((p) => paths.add(p));
      if (link.sponsor) sponsorPagePaths(link.sponsor.slug).forEach((p) => paths.add(p));
    }
  }
  return [...paths];
}

/** Purge the footprint read before a write plus the one after, and the lists of talks. */
export async function revalidateSpeakerFootprint(before: string[], speakerIds: number[]): Promise<void> {
  const after = await speakerFootprint(speakerIds);
  await revalidatePaths([...new Set([...before, ...after, ...conferenceListPaths()])]);
}

/**
 * Every page that shows these talks (#633): their own two addresses, the page of
 * each of their speakers, which lists their sessions, and their year's archive.
 * Same before/after reading as speakerFootprint: a talk that loses a speaker
 * must leave that speaker's page.
 */
export async function talkFootprint(talkIds: number[]): Promise<string[]> {
  if (talkIds.length === 0) return [];
  const talks = await prisma.talk.findMany({
    where: { id: { in: talkIds } },
    select: { slug: true, edition: { select: { year: true } }, speakers: { select: { slug: true } } },
  });

  const paths = new Set<string>();
  for (const talk of talks) {
    talkPagePaths(talk.slug, talk.edition.year).forEach((p) => paths.add(p));
    editionPagePaths(talk.edition.year).forEach((p) => paths.add(p));
    for (const speaker of talk.speakers) speakerPagePaths(speaker.slug).forEach((p) => paths.add(p));
  }
  return [...paths];
}

/** Purge the footprint read before a write plus the one after, and the lists of talks. */
export async function revalidateTalkFootprint(before: string[], talkIds: number[]): Promise<void> {
  const after = await talkFootprint(talkIds);
  await revalidatePaths([...new Set([...before, ...after, ...conferenceListPaths()])]);
}
