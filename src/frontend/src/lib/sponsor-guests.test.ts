import { describe, it, expect, vi, afterEach } from "vitest";

import { EMPTY_GUEST, guestDraftError, timeLeft } from "./sponsor-guests";

// #728 — the deadline is a time on the venue's clock: a sponsor reading it from
// abroad must see Paris time, not theirs.

describe("formatDeadline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("should print the Paris wall-clock time whatever the reader's zone", async () => {
    vi.stubEnv("TZ", "America/New_York");
    vi.resetModules();
    const { formatDeadline } = await import("./sponsor-guests");

    expect(formatDeadline("2026-11-13T22:59:00.000Z")).toBe("vendredi 13 novembre à 23:59");
  });
});

describe("timeLeft", () => {
  const now = new Date("2026-10-26T12:00:00Z");

  it("should count in days, then hours, then say less than an hour", () => {
    expect(timeLeft("2026-11-13T22:59:00Z", now)).toBe("18 jours");
    expect(timeLeft("2026-10-27T17:00:00Z", now)).toBe("29 heures");
    expect(timeLeft("2026-10-26T12:30:00Z", now)).toBe("moins d'une heure");
  });

  it("should have nothing left once passed", () => {
    expect(timeLeft("2026-10-26T11:00:00Z", now)).toBeNull();
  });
});

describe("guestDraftError", () => {
  it("should name the first missing field", () => {
    expect(guestDraftError({ ...EMPTY_GUEST, lastName: "Martin", firstName: "Paul", email: "paul@" })).toBe(
      "Renseignez une adresse e-mail valide.",
    );
  });

  it("should accept a complete guest", () => {
    expect(
      guestDraftError({ ...EMPTY_GUEST, lastName: "Martin", firstName: "Paul", email: "paul@example.org", gender: "MALE", experience: "STUDENT" }),
    ).toBeNull();
  });
});
