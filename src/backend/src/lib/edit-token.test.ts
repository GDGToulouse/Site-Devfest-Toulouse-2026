import { describe, it, expect } from "vitest";
import {
  generateEditToken,
  isEditingFrozen,
  isEditTokenExpired,
  EDIT_TOKEN_TTL_DAYS,
} from "./edit-token.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("generateEditToken", () => {
  it("should return 64 hex chars (256 bits of entropy)", () => {
    const token = generateEditToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should return a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateEditToken()));

    expect(tokens.size).toBe(100);
  });
});

describe("isEditingFrozen", () => {
  const start = new Date("2026-11-19T09:00:00Z");

  it("should not freeze when the event is more than 48h away", () => {
    const now = new Date(start.getTime() - 49 * HOUR);

    expect(isEditingFrozen(start, now)).toBe(false);
  });

  it("should freeze once within the 48h window", () => {
    const now = new Date(start.getTime() - 47 * HOUR);

    expect(isEditingFrozen(start, now)).toBe(true);
  });

  it("should freeze after the event has started", () => {
    const now = new Date(start.getTime() + HOUR);

    expect(isEditingFrozen(start, now)).toBe(true);
  });

  it("should not freeze when the edition has no start date", () => {
    expect(isEditingFrozen(null, new Date())).toBe(false);
  });
});

describe("isEditTokenExpired", () => {
  const sentAt = new Date("2026-07-01T10:00:00Z");

  it("should not expire a token sent just now", () => {
    expect(isEditTokenExpired(sentAt, sentAt)).toBe(false);
  });

  it("should not expire a token still inside its TTL", () => {
    const now = new Date(sentAt.getTime() + (EDIT_TOKEN_TTL_DAYS - 1) * DAY);

    expect(isEditTokenExpired(sentAt, now)).toBe(false);
  });

  it("should expire a token past its TTL", () => {
    const now = new Date(sentAt.getTime() + (EDIT_TOKEN_TTL_DAYS + 1) * DAY);

    expect(isEditTokenExpired(sentAt, now)).toBe(true);
  });

  // Tokens predate the TTL rule (#223): locking their owners out retroactively
  // would break links already in speakers' mailboxes.
  it("should not expire a token that has no send date", () => {
    expect(isEditTokenExpired(null, new Date())).toBe(false);
  });
});
