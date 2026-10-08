import { describe, it, expect } from "vitest";
import { invitesSponsors, isTicketingPhase } from "./edition-phase";

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
});
