// Vitest sees the test file before the lib resets ENV, so we lock the secret
// at module-import time.
process.env.BROCHURE_TOKEN_SECRET = "test-secret-123";

import { describe, it, expect } from "vitest";
import { makeToken, verifyToken } from "./brochure-token.js";

describe("brochure-token", () => {
  it("round-trips a valid token", () => {
    const token = makeToken(42);
    expect(token).not.toBeNull();
    expect(verifyToken(token!)).toBe(42);
  });

  it("rejects a token signed with a different id (signature mismatch)", () => {
    const token = makeToken(42)!;
    const tampered = token.replace(/^42\./, "43.");
    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects a token with garbage signature", () => {
    expect(verifyToken("42.not-a-real-signature")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("nodot")).toBeNull();
    expect(verifyToken(".justasig")).toBeNull();
    expect(verifyToken("abc.sig")).toBeNull();
    expect(verifyToken("0.sig")).toBeNull();
    expect(verifyToken("-1.sig")).toBeNull();
  });
});
