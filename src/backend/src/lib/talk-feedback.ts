import { parseWallTime } from "./zoned-time.js";

// The audience's opinion of a session (#563, #564), on the model of
// OpenFeedback by Hugo Gresse: appreciations ticked from a fixed list, then an
// optional private message to the speaker.

// OpenFeedback's default voting form, in its order. Codes are stored, labels
// live in the frontend translations: wording can change without touching votes.
export const TALK_FEEDBACK_ITEMS = [
  { code: "fun", isPositive: true },
  { code: "learned", isPositive: true },
  { code: "interesting", isPositive: true },
  { code: "speaker", isPositive: true },
  { code: "notClear", isPositive: false },
  { code: "tooTechnical", isPositive: false },
  { code: "lackOfDemo", isPositive: false },
  { code: "tooComplex", isPositive: false },
] as const;

export const TALK_FEEDBACK_CODES = TALK_FEEDBACK_ITEMS.map((item) => item.code);

/** Below this many votes the public sees no trend: two opinions are not one. */
export const PUBLIC_TREND_MIN_VOTES = 5;
/** The public trend shows this many appreciations, the most ticked first. */
export const PUBLIC_TREND_SIZE = 3;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

export type FeedbackPhase = "upcoming" | "open" | "closed";

interface EditionDates {
  startDate: Date | null;
  endDate: Date | null;
}

// Edition dates are calendar days stored at UTC midnight; read the day, not the
// instant, then place it on Paris clocks (the container runs in UTC).
function calendarDay(date: Date, plusDays = 0): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + plusDays));
  return day.toISOString().slice(0, 10);
}

/**
 * Votes open at midnight in Paris on the first day of the event and close at
 * midnight after the following day: the day of the event and the next (#563).
 * Null when the edition has no date yet.
 */
export function feedbackWindow(edition: EditionDates): { opensAt: Date; closesAt: Date } | null {
  if (!edition.startDate) return null;
  const lastDay = edition.endDate && edition.endDate > edition.startDate ? edition.endDate : edition.startDate;
  const opensAt = parseWallTime(`${calendarDay(edition.startDate)}T00:00`);
  const closesAt = parseWallTime(`${calendarDay(lastDay, 2)}T00:00`);
  return opensAt && closesAt ? { opensAt, closesAt } : null;
}

export function feedbackPhase(edition: EditionDates, now: Date = new Date()): FeedbackPhase {
  const window = feedbackWindow(edition);
  if (!window || now < window.opensAt) return "upcoming";
  return now < window.closesAt ? "open" : "closed";
}

/**
 * The trend shown to everyone: the positive appreciations most ticked, as a
 * share of the votes. Never the negative ones — those are for the speaker and
 * the team — and nothing at all under PUBLIC_TREND_MIN_VOTES.
 */
export function publicTrend(votes: { items: string[] }[]): { code: string; percent: number }[] | null {
  if (votes.length < PUBLIC_TREND_MIN_VOTES) return null;
  return TALK_FEEDBACK_ITEMS.filter((item) => item.isPositive)
    .map((item, order) => ({
      code: item.code,
      count: votes.filter((vote) => vote.items.includes(item.code)).length,
      order,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, PUBLIC_TREND_SIZE)
    .map(({ code, count }) => ({ code, percent: Math.round((count / votes.length) * 100) }));
}
