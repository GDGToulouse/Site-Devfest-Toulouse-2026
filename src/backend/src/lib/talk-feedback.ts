import { parseWallTime } from "./zoned-time.js";

// The audience's opinion of a session (#563, #564), on the model of
// OpenFeedback by Hugo Gresse: appreciations ticked from a fixed list, then an
// optional private message to the speaker.

// OpenFeedback's default voting form, in its order. Codes are stored, labels
// live in the frontend translations: wording can change without touching votes.
// The labels serve the recap email (#567); the site reads its own from
// messages/*.json (feedback.items), and talk-feedback-labels.test.ts keeps the
// two identical.
export const TALK_FEEDBACK_ITEMS = [
  { code: "fun", fr: "Drôle/original 😃", en: "Fun 😃" },
  { code: "learned", fr: "J'ai beaucoup appris 🤓", en: "I've learned a lot 🤓" },
  { code: "interesting", fr: "Super intéressant 👍", en: "Very interesting 👍" },
  { code: "speaker", fr: "Très bon orateur/oratrice 👏", en: "Good speaker 👏" },
  { code: "notClear", fr: "Pas clair 🧐", en: "Not clear 🧐" },
  { code: "tooTechnical", fr: "Trop technique 🤖", en: "Too technical 🤖" },
  { code: "lackOfDemo", fr: "Pas assez de démo/exemple 🤔", en: "Lack of demo/example 🤔" },
  { code: "tooComplex", fr: "Trop complexe 🤯", en: "Too complex 🤯" },
] as const;

export const TALK_FEEDBACK_CODES = TALK_FEEDBACK_ITEMS.map((item) => item.code);

export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

export type FeedbackPhase = "upcoming" | "open" | "closed";

interface EditionDates {
  startDate: Date | null;
  endDate: Date | null;
  /** #566: opens voting before the day, for the team to try it. */
  feedbackTestMode?: boolean;
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
  if (!window) return "upcoming";
  if (now < window.opensAt) return edition.feedbackTestMode ? "open" : "upcoming";
  return now < window.closesAt ? "open" : "closed";
}

// Long enough to vote before leaving the room, short enough that the audience
// has seen most of the talk (#809).
const SESSION_OPENS_BEFORE_END_MS = 10 * 60 * 1000;

interface SessionTimes {
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * When the audience may vote on a session (#809): ten minutes before it ends,
 * or at its start when it has no end. Null when it has no time at all.
 */
export function sessionFeedbackOpensAt(talk: SessionTimes): Date | null {
  if (talk.endsAt) return new Date(talk.endsAt.getTime() - SESSION_OPENS_BEFORE_END_MS);
  return talk.startsAt;
}

/**
 * The edition's window, narrowed to the session (#809): on the day, a session
 * opens ten minutes before its end. The test mode (#566) skips that rule — before
 * the event every session is in the future, and the team could try nothing.
 */
export function sessionFeedbackPhase(edition: EditionDates, talk: SessionTimes, now: Date = new Date()): FeedbackPhase {
  const phase = feedbackPhase(edition, now);
  if (phase !== "open" || isTestVote(edition, now)) return phase;
  const opensAt = sessionFeedbackOpensAt(talk);
  return opensAt && now >= opensAt ? "open" : "upcoming";
}

/**
 * A vote cast now is a test (#566): the test mode is on and the real window
 * has not opened yet. From the event day on, a vote is real whatever the flag
 * says, so a test mode left on cannot taint the day.
 */
export function isTestVote(edition: EditionDates, now: Date = new Date()): boolean {
  const window = feedbackWindow(edition);
  return Boolean(edition.feedbackTestMode && window && now < window.opensAt);
}

export interface PublicResults {
  votes: number;
  /** Every appreciation of the fixed list, in its order, negatives included. */
  items: { code: string; count: number }[];
}

/**
 * The results shown to everyone, from the first vote and whether one has voted
 * or not (#803): the count of every appreciation. The messages are not in it —
 * they stay between the audience, the speaker and the team.
 */
export function publicResults(votes: { items: string[] }[]): PublicResults {
  return {
    votes: votes.length,
    items: TALK_FEEDBACK_ITEMS.map(({ code }) => ({
      code,
      count: votes.filter((vote) => vote.items.includes(code)).length,
    })),
  };
}
