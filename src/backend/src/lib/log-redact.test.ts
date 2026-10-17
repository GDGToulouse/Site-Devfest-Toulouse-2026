import { describe, it, expect } from "vitest";

import { redactUrl } from "./log-redact.js";

// A speaker's edit link, an invitation and a magic link are bearer secrets
// carried in the URL: each request line logged them in clear (#658).
describe("redactUrl", () => {
  it.each([
    ["/api/edit/3fe8abcd/talks/12", "/api/edit/[redacted]/talks/12"],
    ["/api/sponsor-invitation/8c28ffee/accept", "/api/sponsor-invitation/[redacted]/accept"],
    ["/api/brochure/tok123", "/api/brochure/[redacted]"],
    ["/api/auth/magic-link/verify?token=abc&callbackURL=%2Fsponsor", "/api/auth/magic-link/verify?token=[redacted]&callbackURL=%2Fsponsor"],
    ["/api/auth/reset-password/xyz789?callbackURL=%2Fadmin", "/api/auth/reset-password/[redacted]?callbackURL=%2Fadmin"],
  ])("should mask the secret in %s", (url, expected) => {
    expect(redactUrl(url)).toBe(expected);
  });

  it("should leave an ordinary URL alone", () => {
    expect(redactUrl("/api/speakers/marie-dupont?lang=fr")).toBe("/api/speakers/marie-dupont?lang=fr");
  });
});
