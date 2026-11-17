import { afterAll, beforeAll, vi } from "vitest";

import { prisma } from "../lib/prisma.js";

// Editions created by tests live before every seeded edition (2016+), so they
// can never be picked as "the most recent one" — see TEST_YEAR in
// sessionize-import-mapping.test.ts and #292.
const FIRST_SEEDED_YEAR = 2016;

// The edition test fixtures attach themselves to.
//
// Files used to call `findFirst({ orderBy: { year: "desc" } })` directly, which
// silently followed whatever edition happened to be newest — including one
// another test had just created and was about to delete. Vitest runs files in
// parallel, so that race surfaced as `Sponsor_editionId_fkey` violations in
// whichever file lost it (#292).
//
// Filtering on the seeded range keeps the intent ("a real edition from the
// seed") without hardcoding a year that would need bumping every edition.
export async function getSeededEdition() {
  const edition = await prisma.edition.findFirst({
    where: { year: { gte: FIRST_SEEDED_YEAR } },
    orderBy: { year: "desc" },
  });
  if (!edition) throw new Error("seed missing an edition");
  return edition;
}

/**
 * Pins the clock a week before the seeded edition starts, for the files that
 * go through a speaker's modification link. The link freezes 48 h before the
 * event (RG-246), and those files attach to the seeded edition: from that
 * moment every run failed, in CI too, on code that had not changed. Only
 * `Date` is faked, so timers and the database driver keep real time.
 * Call it at the top of the file, before its own `beforeAll`.
 */
export function pinClockBeforeEditFreeze(): void {
  beforeAll(async () => {
    const { startDate } = await getSeededEdition();
    if (!startDate) return;
    const weekBefore = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (Date.now() < weekBefore.getTime()) return;
    vi.useFakeTimers({ toFake: ["Date"], now: weekBefore, shouldAdvanceTime: true });
  });
  afterAll(() => {
    vi.useRealTimers();
  });
}
