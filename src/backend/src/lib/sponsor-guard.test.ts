import { describe, it, expect } from "vitest";

import { hasAtLeast } from "./sponsor-guard.js";
import { isInvitationExpired, INVITATION_TTL_DAYS, MAGIC_LINK_TTL_MINUTES } from "./edit-token.js";

// #362 — the two rules a reader has to trust without running the app: what each
// access role may do, and when an invitation stops working.

describe("hasAtLeast — sponsor access ranks", () => {
  it("grants a role everything a lower one grants", () => {
    expect(hasAtLeast("RESPONSABLE", "STAND")).toBe(true);
    expect(hasAtLeast("RESPONSABLE", "EDITEUR")).toBe(true);
    expect(hasAtLeast("EDITEUR", "STAND")).toBe(true);
  });

  it("refuses a role below the minimum asked for", () => {
    // The whole point of STAND: read-only on the public profile.
    expect(hasAtLeast("STAND", "EDITEUR")).toBe(false);
    expect(hasAtLeast("STAND", "RESPONSABLE")).toBe(false);
    // An EDITEUR edits but never invites.
    expect(hasAtLeast("EDITEUR", "RESPONSABLE")).toBe(false);
  });

  it("grants each role its own level", () => {
    expect(hasAtLeast("STAND", "STAND")).toBe(true);
    expect(hasAtLeast("EDITEUR", "EDITEUR")).toBe(true);
    expect(hasAtLeast("RESPONSABLE", "RESPONSABLE")).toBe(true);
  });
});

describe("isInvitationExpired", () => {
  const sentAt = new Date("2026-08-01T10:00:00Z");

  it("accepts an invitation inside its window", () => {
    const sixDaysLater = new Date("2026-08-07T09:00:00Z");
    expect(isInvitationExpired(sentAt, sixDaysLater)).toBe(false);
  });

  it("refuses one past the window", () => {
    const eightDaysLater = new Date("2026-08-09T10:00:00Z");
    expect(isInvitationExpired(sentAt, eightDaysLater)).toBe(true);
  });

  // Opposite of isEditTokenExpired, which treats a missing date as valid to
  // avoid locking out speakers whose token predates that rule. An invitation
  // with no send date is malformed, and defaulting to "open" would leave the
  // sign-up door ajar.
  it("refuses an invitation with no send date", () => {
    expect(isInvitationExpired(null)).toBe(true);
  });
});

describe("token lifetimes stay distinct", () => {
  // Three secrets, three windows (#362). Collapsing them would either make the
  // invitation unusable or leave a sign-in link valid for weeks.
  it("keeps the invitation in days and the magic link in minutes", () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(MAGIC_LINK_TTL_MINUTES).toBe(60);
  });
});
