import { describe, it, expect } from "vitest";
import { headerCall, invitesSponsors, isProgrammePhase, isTicketingPhase, showsCountdown } from "./edition-phase";

describe("edition phase (#576)", () => {
  it("should invite sponsors while the edition is announced", () => {
    expect(invitesSponsors({ status: "ANNOUNCEMENT", sponsorPageStatus: "OPEN" })).toBe(true);
  });

  it("should stop inviting sponsors in the last month, whatever the sponsoring page says", () => {
    expect(invitesSponsors({ status: "TICKETING", sponsorPageStatus: "OPEN" })).toBe(false);
  });

  it("should stop inviting sponsors once the sponsoring page is sold out", () => {
    expect(invitesSponsors({ status: "ANNOUNCEMENT", sponsorPageStatus: "SOLD_OUT" })).toBe(false);
  });

  it("should invite no one without an edition", () => {
    expect(invitesSponsors(null)).toBe(false);
  });

  it("should recognise the last month only", () => {
    expect(isTicketingPhase({ status: "TICKETING" })).toBe(true);
    expect(isTicketingPhase({ status: "ANNOUNCEMENT" })).toBe(false);
    expect(isTicketingPhase(null)).toBe(false);
  });

  it("should stop inviting sponsors in the last week and on the day (#577)", () => {
    expect(invitesSponsors({ status: "PROGRAMME", sponsorPageStatus: "OPEN" })).toBe(false);
    expect(invitesSponsors({ status: "EVENT_DAY", sponsorPageStatus: "OPEN" })).toBe(false);
  });

  it("should put the programme first in the last week and on the day (#577)", () => {
    expect(isProgrammePhase({ status: "PROGRAMME" })).toBe(true);
    expect(isProgrammePhase({ status: "EVENT_DAY" })).toBe(true);
    expect(isProgrammePhase({ status: "TICKETING" })).toBe(false);
  });

  it("should give the header the ticket office, then the programme (#577)", () => {
    expect(headerCall({ status: "ANNOUNCEMENT" })).toBeNull();
    expect(headerCall({ status: "TICKETING" })).toBe("tickets");
    expect(headerCall({ status: "PROGRAMME" })).toBe("programme");
    expect(headerCall({ status: "EVENT_DAY" })).toBe("programme");
  });

  it("should count down over the whole last stretch only", () => {
    expect(showsCountdown({ status: "TICKETING" })).toBe(true);
    expect(showsCountdown({ status: "EVENT_DAY" })).toBe(true);
    expect(showsCountdown({ status: "ANNOUNCEMENT" })).toBe(false);
  });
});
