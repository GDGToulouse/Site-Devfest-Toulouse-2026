import { describe, it, expect } from "vitest";

import { TranslationError, QuotaExhaustedError, sendTranslationError } from "./errors.js";

// A minimal fake of the bits of a Fastify reply the helper touches, recording
// what it was asked to send. `.status()` returns `this` so the chain works.
function fakeReply() {
  const record = { status: 0, headers: {} as Record<string, string>, payload: null as unknown };
  const reply = {
    status(code: number) {
      record.status = code;
      return reply;
    },
    header(name: string, value: string) {
      record.headers[name] = value;
      return reply;
    },
    send(payload: unknown) {
      record.payload = payload;
      return payload;
    },
  };
  return { reply, record };
}

describe("sendTranslationError (#305)", () => {
  // The mapping that used to be copy-pasted and had drifted. Each code must
  // yield the same status wherever the helper is called.
  const cases: [TranslationError["code"], number][] = [
    ["invalid_input", 400],
    ["content_too_large", 413],
    ["tag_mismatch", 422],
    ["placeholder_mismatch", 422],
    ["rate_limit", 429],
    ["not_configured", 503],
    ["upstream_error", 502],
  ];

  it.each(cases)("maps %s to %i", (code, status) => {
    const { reply, record } = fakeReply();
    sendTranslationError(reply, new TranslationError(code, "boom"));
    expect(record.status).toBe(status);
    expect(record.payload).toMatchObject({ error: code, message: "boom" });
  });

  it("carries Retry-After and retryAfterSec on a quota error", () => {
    const { reply, record } = fakeReply();
    sendTranslationError(reply, new QuotaExhaustedError("slow down", 42));
    expect(record.status).toBe(429);
    expect(record.headers["Retry-After"]).toBe("42");
    expect(record.payload).toMatchObject({ error: "quota_exhausted", retryAfterSec: 42 });
  });

  it("defaults Retry-After to 60 when the quota error omits it", () => {
    const { reply, record } = fakeReply();
    sendTranslationError(reply, new QuotaExhaustedError("slow down"));
    expect(record.headers["Retry-After"]).toBe("60");
  });

  it("falls back to a generic 500 for a non-translation error", () => {
    const { reply, record } = fakeReply();
    sendTranslationError(reply, new Error("unexpected"));
    expect(record.status).toBe(500);
    // The raw message must not leak — only a generic code.
    expect(record.payload).toEqual({ error: "internal_error" });
  });

  // The regression that motivated the fix: `rate_limit` and `not_configured`
  // were missing from the article endpoint's copy, so they fell through to 502.
  // Now every caller shares this helper, so those cannot drift again.
  it("no longer lets rate_limit or not_configured fall through to 502", () => {
    for (const code of ["rate_limit", "not_configured"] as const) {
      const { reply, record } = fakeReply();
      sendTranslationError(reply, new TranslationError(code, "x"));
      expect(record.status).not.toBe(502);
    }
  });
});
