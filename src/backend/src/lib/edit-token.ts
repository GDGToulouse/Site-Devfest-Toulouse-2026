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
