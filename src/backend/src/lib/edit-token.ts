import { randomBytes } from "node:crypto";

// Crypto-random modification-link token: 32 bytes -> 64 hex chars, far above
// the 32-char minimum (RG-248). Stored on the entity (editToken) so it can be
// revoked simply by clearing/replacing it (RG-244).
export function generateEditToken(): string {
  return randomBytes(32).toString("hex");
}

// Modification links are frozen 48h before the event starts (RG-246). Returns
// true when editing should be blocked because we are within that window (or
// past the start). A null start date means we cannot freeze yet -> not frozen.
const FREEZE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isEditingFrozen(editionStartDate: Date | null, now: Date = new Date()): boolean {
  if (!editionStartDate) return false;
  return now.getTime() >= editionStartDate.getTime() - FREEZE_WINDOW_MS;
}

// A modification link is a bearer secret sitting in someone's mailbox: it must
// not stay valid forever. It expires 30 days after being sent (#223); the admin
// can always send a fresh one. A token with no send date predates this rule —
// treat it as valid rather than locking out speakers retroactively.
export const EDIT_TOKEN_TTL_DAYS = 30;
const EDIT_TOKEN_TTL_MS = EDIT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isEditTokenExpired(sentAt: Date | null, now: Date = new Date()): boolean {
  if (!sentAt) return false;
  return now.getTime() - sentAt.getTime() > EDIT_TOKEN_TTL_MS;
}
