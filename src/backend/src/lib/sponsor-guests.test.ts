import { describe, it, expect } from "vitest";

import { defaultGuestDeadline, quotaOf, rankGuests, registrationState } from "./sponsor-guests.js";

// #727 — the rules every guest screen shares, on plain values.

function guest(id: number, createdAt: string, email = `g${id}@example.org`) {
  return { id, email, createdAt: new Date(createdAt), billetwebTicketId: null };
}

describe("defaultGuestDeadline (RG-INS-21)", () => {
  it("should close on the Friday before a Thursday event, 23:59 Paris time", () => {
    // 2026-11-19 is a Thursday; Paris is UTC+1 in November.
    expect(defaultGuestDeadline(new Date("2026-11-19T08:00:00Z"))?.toISOString()).toBe("2026-11-13T22:59:00.000Z");
  });

  it("should close a full week earlier when the event is on a Friday", () => {
    expect(defaultGuestDeadline(new Date("2026-11-20T08:00:00Z"))?.toISOString()).toBe("2026-11-13T22:59:00.000Z");
  });

  it("should follow summer time when the Friday is after the clocks change", () => {
    // Clocks go forward on 2027-03-28: Friday 2 April is UTC+2.
    expect(defaultGuestDeadline(new Date("2027-04-08T07:00:00Z"))?.toISOString()).toBe("2027-04-02T21:59:00.000Z");
  });

  it("should read the start date in Paris time, not UTC", () => {
    // 00:30 on Saturday in Paris is still Friday in UTC: the Friday before is
    // the day before, not a week earlier.
    expect(defaultGuestDeadline(new Date("2026-11-20T23:30:00Z"))?.toISOString()).toBe("2026-11-20T22:59:00.000Z");
  });

  it("should have no deadline without a start date", () => {
    expect(defaultGuestDeadline(null)).toBeNull();
  });
});

describe("registrationState (RG-INS-22, RG-INS-28)", () => {
  const edition = {
    id: 1,
    startDate: new Date("2026-11-19T08:00:00Z"),
    isSponsorGuestRegistrationOpen: true,
    sponsorGuestRegistrationOpenedAt: new Date("2026-10-01T00:00:00Z"),
    sponsorGuestDeadline: null,
  };

  it("should let sponsors write while open and before the deadline", () => {
    expect(registrationState(edition, new Date("2026-11-13T22:58:00Z")).canSponsorWrite).toBe(true);
  });

  it("should stop sponsors after the deadline", () => {
    const state = registrationState(edition, new Date("2026-11-13T23:00:00Z"));
    expect(state.isPastDeadline).toBe(true);
    expect(state.canSponsorWrite).toBe(false);
  });

  it("should stop sponsors when closed, and tell a closed edition from one never opened", () => {
    const closed = registrationState({ ...edition, isSponsorGuestRegistrationOpen: false }, new Date("2026-10-26"));
    const neverOpened = registrationState(
      { ...edition, isSponsorGuestRegistrationOpen: false, sponsorGuestRegistrationOpenedAt: null },
      new Date("2026-10-26"),
    );
    expect(closed.canSponsorWrite).toBe(false);
    expect(closed.hasEverOpened).toBe(true);
    expect(neverOpened.hasEverOpened).toBe(false);
  });

  it("should prefer the deadline set by an admin", () => {
    const state = registrationState(
      { ...edition, sponsorGuestDeadline: new Date("2026-10-31T22:59:00Z") },
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(state.isPastDeadline).toBe(true);
    expect(state.isDeadlineDefault).toBe(false);
  });
});

describe("quotaOf (RG-INS-12)", () => {
  it("should add the adjustments to the offer's places", () => {
    expect(quotaOf(4, [{ quantity: 3 }, { quantity: -1 }]).quota).toBe(6);
  });

  it("should never go below zero", () => {
    expect(quotaOf(2, [{ quantity: -5 }]).quota).toBe(0);
  });
});

describe("rankGuests (RG-INS-13, RG-INS-25)", () => {
  it("should put the last registered out of quota", () => {
    const ranked = rankGuests(
      [guest(3, "2026-10-03"), guest(1, "2026-10-01"), guest(2, "2026-10-02")],
      2,
    );
    expect(ranked.map((g) => [g.id, g.rank, g.isWithinQuota])).toEqual([
      [1, 1, true],
      [2, 2, true],
      [3, 3, false],
    ]);
  });

  it("should break a tie on the registration time by id", () => {
    const ranked = rankGuests([guest(8, "2026-10-01"), guest(7, "2026-10-01")], 1);
    expect(ranked[0].id).toBe(7);
    expect(ranked[1].isWithinQuota).toBe(false);
  });

  it("should flag the same address used twice, whatever its case", () => {
    const ranked = rankGuests(
      [guest(1, "2026-10-01", "Ana@Example.org"), guest(2, "2026-10-02", "ana@example.org"), guest(3, "2026-10-03")],
      5,
    );
    expect(ranked.map((g) => g.hasDuplicateEmail)).toEqual([true, true, false]);
  });
});
