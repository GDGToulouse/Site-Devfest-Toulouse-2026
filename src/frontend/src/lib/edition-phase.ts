import type { Edition } from "./types";

// What the current phase of the edition puts forward, shared by the header of
// every page and the home page so the two cannot disagree.

/**
 * Whether the site still invites companies to become sponsors. Not once the
 * sponsoring page says sold out, and not in the last month (#576): the site
 * then sells tickets, and the sponsors already on board keep their logos.
 */
export function invitesSponsors(edition: Pick<Edition, "status" | "sponsorPageStatus"> | null): boolean {
  if (!edition) return false;
  return edition.sponsorPageStatus !== "SOLD_OUT" && edition.status !== "TICKETING";
}

/** The last month before the event: the ticket office comes first (#576). */
export function isTicketingPhase(edition: Pick<Edition, "status"> | null): boolean {
  return edition?.status === "TICKETING";
}
