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
