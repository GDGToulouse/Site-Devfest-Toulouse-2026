import type { EditionSummary } from "./types";

// The steps of the editions timeline (#104), newest first: the coming edition
// on top, then every past one, with a marker where years went by without a
// DevFest (2020-2022) so the story reads with its gap.

export type TimelineStep =
  | { type: "edition"; year: number; startDate: string | null; venueName: string | null; isUpcoming: boolean; isFirst: boolean }
  | { type: "gap"; from: number; to: number };

export function buildTimeline(editions: EditionSummary[]): TimelineStep[] {
  const past = editions.filter((e) => e.status === "SEE_YOU_NEXT_YEAR");
  const latestPast = Math.max(...past.map((e) => e.year), -Infinity);
  // The coming one: the most recent edition not over yet, if it is newer than
  // every past one (an edition still in preparation for a year already held
  // would be a data mistake, not a step).
  const upcoming = editions
    .filter((e) => e.status !== "SEE_YOU_NEXT_YEAR" && e.year > latestPast)
    .sort((a, b) => b.year - a.year)[0];
  const shown = [...(upcoming ? [upcoming] : []), ...past.sort((a, b) => b.year - a.year)];
  const firstYear = Math.min(...shown.map((e) => e.year));

  const steps: TimelineStep[] = [];
  shown.forEach((edition, index) => {
    const previous = shown[index - 1];
    if (previous && previous.year - edition.year > 1) {
      steps.push({ type: "gap", from: edition.year + 1, to: previous.year - 1 });
    }
    steps.push({
      type: "edition",
      year: edition.year,
      startDate: edition.startDate,
      venueName: edition.venueName,
      isUpcoming: edition === upcoming,
      isFirst: edition.year === firstYear,
    });
  });
  return steps;
}
