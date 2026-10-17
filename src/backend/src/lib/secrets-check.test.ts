import { describe, it, expect } from "vitest";

import { assertSecretsConfigured } from "./secrets-check.js";

// The placeholders of .env.example and the compose defaults are public: a
// deployed environment that kept one signs its sessions with a known key.
describe("assertSecretsConfigured", () => {
  const strong = "x".repeat(40);

  it("should accept a local run with the placeholders", () => {
    expect(() => assertSecretsConfigured({ SESSION_SECRET: "change-me-session-secret-min-32-chars" })).not.toThrow();
  });

  it("should refuse a deployed environment whose session secret is a placeholder", () => {
    expect(() =>
      assertSecretsConfigured({ ENV_NAME: "dev-j", SESSION_SECRET: "change-me-session-secret-min-32-chars" }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("should refuse production without a session secret", () => {
    expect(() => assertSecretsConfigured({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
  });

  it("should refuse any other secret left at its placeholder", () => {
    expect(() =>
      assertSecretsConfigured({ ENV_NAME: "beta", SESSION_SECRET: strong, REVALIDATE_SECRET: "change-me-revalidate" }),
    ).toThrow(/REVALIDATE_SECRET/);
  });

  it("should accept a deployed environment with real secrets", () => {
    expect(() => assertSecretsConfigured({ ENV_NAME: "prod", NODE_ENV: "production", SESSION_SECRET: strong })).not.toThrow();
  });
});
