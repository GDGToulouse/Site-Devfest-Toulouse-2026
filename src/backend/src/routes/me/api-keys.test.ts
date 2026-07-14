import { describe, it, expect } from "vitest";
import { rotationBlockedReason } from "./api-keys.js";

const NOW = new Date("2026-06-01T12:00:00Z");
const PAST = new Date("2026-05-01T00:00:00Z");
const FUTURE = new Date("2026-07-01T00:00:00Z");

describe("rotationBlockedReason", () => {
  it("should allow rotating an active key with no expiry", () => {
    expect(rotationBlockedReason({ revokedAt: null, expiresAt: null }, NOW)).toBeNull();
  });

  it("should allow rotating a key whose expiry is still ahead", () => {
    expect(rotationBlockedReason({ revokedAt: null, expiresAt: FUTURE }, NOW)).toBeNull();
  });

  // Rotating a revoked key would silently un-revoke it — the opposite of intent.
  it("should refuse to rotate a revoked key", () => {
    expect(rotationBlockedReason({ revokedAt: PAST, expiresAt: null }, NOW)).toBe("key_revoked");
  });

  it("should refuse to rotate an expired key", () => {
    expect(rotationBlockedReason({ revokedAt: null, expiresAt: PAST }, NOW)).toBe("key_expired");
  });

  it("should report revocation first when a key is both revoked and expired", () => {
    expect(rotationBlockedReason({ revokedAt: PAST, expiresAt: PAST }, NOW)).toBe("key_revoked");
  });

  it("should treat an expiry falling exactly now as expired", () => {
    expect(rotationBlockedReason({ revokedAt: null, expiresAt: NOW }, NOW)).toBe("key_expired");
  });
});
