import { describe, it, expect } from "vitest";
import { devSeedPassword } from "../lib/dev-seed-password.js";

// The documented demo passwords are in the public repository: they may only
// land where no one else reaches the accounts, a local machine or the CI.

describe("devSeedPassword", () => {
  it("should keep the documented passwords when no environment is named", () => {
    expect(devSeedPassword({})).toBeNull();
  });

  it("should keep the documented passwords locally", () => {
    expect(devSeedPassword({ ENV_NAME: "local" })).toBeNull();
  });

  it("should use DEV_SEED_PASSWORD when it is set", () => {
    expect(devSeedPassword({ ENV_NAME: "dev-j", DEV_SEED_PASSWORD: "a-long-enough-secret" })).toBe("a-long-enough-secret");
  });

  it("should refuse a deployed environment without DEV_SEED_PASSWORD", () => {
    expect(() => devSeedPassword({ ENV_NAME: "dev-j" })).toThrow(/DEV_SEED_PASSWORD/);
  });

  it("should refuse a short DEV_SEED_PASSWORD", () => {
    expect(() => devSeedPassword({ ENV_NAME: "dev-j", DEV_SEED_PASSWORD: "short" })).toThrow(/DEV_SEED_PASSWORD/);
  });
});
