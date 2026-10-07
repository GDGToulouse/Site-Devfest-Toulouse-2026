import { prisma } from "./prisma.js";
import { feedbackWindow } from "./talk-feedback.js";

// The audience feedback's test mode (#566): opens voting before the event day
// so the team can try it, production included, then wipes what it let in.
// Only test votes are ever deleted — `isTest` is set when the vote is cast,
// from the clock, so a real vote can never be one.

/** Can the test mode be switched on now? Only before voting really opens. */
export function canEnableTestMode(edition: { startDate: Date | null; endDate: Date | null }, now = new Date()): boolean {
  const window = feedbackWindow(edition);
  return Boolean(window && now < window.opensAt);
}

/** Test votes of an edition's sessions, for the confirmation before wiping. */
export function countTestVotes(editionId: number): Promise<number> {
  return prisma.talkFeedback.count({ where: { isTest: true, talk: { editionId } } });
}

/** Switches the test mode off and deletes the test votes. Returns how many. */
export async function disableTestMode(editionId: number): Promise<number> {
  const [deleted] = await prisma.$transaction([
    prisma.talkFeedback.deleteMany({ where: { isTest: true, talk: { editionId } } }),
    prisma.edition.update({ where: { id: editionId }, data: { feedbackTestMode: false } }),
  ]);
  return deleted.count;
}

/**
 * The editions whose test mode is still on while real voting has opened: the
 * scheduler switches them off at midnight on the event day, and the votes of
 * the trial go with it.
 */
export async function disableExpiredTestModes(now = new Date()): Promise<{ editionId: number; deleted: number }[]> {
  const editions = await prisma.edition.findMany({
    where: { feedbackTestMode: true },
    select: { id: true, startDate: true, endDate: true },
  });
  const expired = editions.filter((edition) => !canEnableTestMode(edition, now));
  const results = [];
  for (const edition of expired) {
    results.push({ editionId: edition.id, deleted: await disableTestMode(edition.id) });
  }
  return results;
}
