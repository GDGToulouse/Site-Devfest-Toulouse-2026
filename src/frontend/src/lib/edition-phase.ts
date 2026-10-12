import type { Edition } from "./types";

// What the current phase of the edition puts forward, shared by the header of
// every page and the home page so the two cannot disagree.

// From a month before the event (#576), through the last week and the day
// itself (#577): the site no longer looks for sponsors.
const LAST_STRETCH: Edition["status"][] = ["TICKETING", "PROGRAMME", "EVENT_DAY"];

/**
 * Whether the site still invites companies to become sponsors. Not once the
 * sponsoring page says sold out, and not in the last stretch before the event:
 * the site then sells tickets and helps people plan their day, and the
 * sponsors already on board keep their logos.
 */
export function invitesSponsors(edition: Pick<Edition, "status" | "sponsorPageStatus"> | null): boolean {
  if (!edition) return false;
  return edition.sponsorPageStatus !== "SOLD_OUT" && !LAST_STRETCH.includes(edition.status);
}

/** The last month before the event: the ticket office comes first (#576). */
export function isTicketingPhase(edition: Pick<Edition, "status"> | null): boolean {
  return edition?.status === "TICKETING";
}

/** The last week and the day itself: the programme comes first (#577). */
export function isProgrammePhase(edition: Pick<Edition, "status"> | null): boolean {
  return edition?.status === "PROGRAMME" || edition?.status === "EVENT_DAY";
}

export function isEventDay(edition: Pick<Edition, "status"> | null): boolean {
  return edition?.status === "EVENT_DAY";
}

/** Whether the hero counts the days left: the whole last stretch. */
export function showsCountdown(edition: Pick<Edition, "status"> | null): boolean {
  return edition ? LAST_STRETCH.includes(edition.status) : false;
}

/** The call the header makes on every page, in the slot the sponsor call held. */
export function headerCall(edition: Pick<Edition, "status"> | null): "tickets" | "programme" | null {
  if (isTicketingPhase(edition)) return "tickets";
  if (isProgrammePhase(edition)) return "programme";
  return null;
}
