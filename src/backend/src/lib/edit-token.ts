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

// An invitation to create a sponsor account (#362). Shorter-lived than an edit
// link and single-use, which is why it has its own token: 7 days is enough for
// an email read the next day, and an invitation that never expires is a bearer
// secret left lying around.
//
// The magic link used to sign in to an existing account is shorter still — 60
// minutes — and lives in auth.ts, where better-auth's plugin owns it.
export const INVITATION_TTL_DAYS = 7;
const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

// Unlike an edit token, a missing send date is NOT treated as valid: an
// invitation without one is malformed, and defaulting to "still open" would
// keep the sign-up door ajar. No such row exists today — the column arrives
// with the feature — so this only guards against a future bug.
export function isInvitationExpired(sentAt: Date | null, now: Date = new Date()): boolean {
  if (!sentAt) return true;
  return now.getTime() - sentAt.getTime() > INVITATION_TTL_MS;
}

// Same shape as generateEditToken, named apart so a call site says which of the
// two secrets it is minting — they have different lifetimes and consumption.
export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

// Sign-in link for an account that already exists (#362). Minutes, not days:
// it is mailed on demand and used straight away, so a long window would only
// widen the replay surface. better-auth owns the token itself and takes the
// TTL in seconds; the value lives here with the other two.
export const MAGIC_LINK_TTL_MINUTES = 60;
export const MAGIC_LINK_TTL_SECONDS = MAGIC_LINK_TTL_MINUTES * 60;
