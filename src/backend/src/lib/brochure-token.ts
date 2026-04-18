import { createHmac, timingSafeEqual } from "node:crypto";

// Per-message brochure links carry a token of the form `<id>.<sig>` where
// `sig` is base64url(HMAC-SHA256(secret, "brochure:<id>")).
//
// The id alone would let anyone iterate /api/brochure/1, /api/brochure/2…
// and rack up download counts for messages they never sent. The HMAC binds
// each id to a secret only the server knows, so guessing is infeasible.
//
// The secret is BROCHURE_TOKEN_SECRET. We refuse to mint or verify tokens
// when it's missing — better to break the email flow than to ship signed
// URLs with an empty key.

// Read at call time so tests can set the env var before invoking — a
// module-level constant would lock to whatever was set at import time.
function getSecret(): string {
  return process.env.BROCHURE_TOKEN_SECRET || "";
}

function sign(id: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`brochure:${id}`)
    .digest("base64url");
}

export function isEnabled(): boolean {
  return getSecret().length > 0;
}

export function makeToken(messageId: number): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return `${messageId}.${sign(messageId, secret)}`;
}

export function verifyToken(token: string): number | null {
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const idPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  const id = Number(idPart);
  if (!Number.isInteger(id) || id <= 0) return null;
  const expected = sign(id, secret);
  // Length check first to keep timingSafeEqual happy.
  if (expected.length !== sigPart.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sigPart))) return null;
  } catch {
    return null;
  }
  return id;
}
