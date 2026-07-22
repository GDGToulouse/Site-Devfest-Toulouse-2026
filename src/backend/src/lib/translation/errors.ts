// Custom error classes for the translation pipeline. Each carries a stable
// `code` consumed by the HTTP layer to build the right status + payload.

export type TranslationErrorCode =
  | "invalid_input"
  | "content_too_large"
  | "tag_mismatch"
  | "placeholder_mismatch"
  | "quota_exhausted"
  | "rate_limit"
  | "upstream_error"
  | "not_configured";

export class TranslationError extends Error {
  code: TranslationErrorCode;
  retryAfterSec?: number;

  constructor(code: TranslationErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "TranslationError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export class QuotaExhaustedError extends TranslationError {
  constructor(message: string, retryAfterSec?: number) {
    super("quota_exhausted", message, retryAfterSec);
    this.name = "QuotaExhaustedError";
  }
}

/** Maps a translation error code to its HTTP status. Single source of truth. */
function statusForCode(code: TranslationErrorCode): number {
  switch (code) {
    case "invalid_input":
      return 400;
    case "content_too_large":
      return 413;
    case "tag_mismatch":
    case "placeholder_mismatch":
      return 422;
    case "rate_limit":
      return 429;
    case "not_configured":
      return 503;
    // upstream_error and any future code fall through to a bad-gateway: the
    // failure is on the translation provider's side, not the caller's.
    default:
      return 502;
  }
}

// Minimal shape of the reply object the handlers pass in, so this file does not
// depend on Fastify's full types. Both `.status()` and `.code()` exist on a
// Fastify reply and are aliases; the handlers already use one or the other.
interface TranslationErrorReply {
  status(code: number): TranslationErrorReply;
  header(name: string, value: string): TranslationErrorReply;
  send(payload: unknown): unknown;
}

/**
 * Turn a translation-pipeline error into the right HTTP response.
 *
 * This mapping used to be copy-pasted into every handler that calls the
 * translator (translate, article translate-fields, file alt-text) and the
 * copies had drifted: `rate_limit` and `not_configured` were missing from the
 * article endpoint, so a quota-exhausted call answered 429 on one route and 502
 * on another (#305). Centralising it here keeps every endpoint consistent.
 *
 * Returns whatever `reply.send()` returns, so callers can `return` it directly.
 */
export function sendTranslationError(reply: TranslationErrorReply, err: unknown): unknown {
  if (err instanceof QuotaExhaustedError) {
    return reply
      .status(429)
      .header("Retry-After", String(err.retryAfterSec ?? 60))
      .send({ error: err.code, message: err.message, retryAfterSec: err.retryAfterSec });
  }
  if (err instanceof TranslationError) {
    return reply.status(statusForCode(err.code)).send({ error: err.code, message: err.message });
  }
  // Not a translation error — the caller must have logged it; surface a generic
  // 500 rather than leaking the message.
  return reply.status(500).send({ error: "internal_error" });
}
