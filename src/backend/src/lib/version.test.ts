import { describe, it, expect, afterEach, vi } from "vitest";

describe("version module", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("falls back to the hardcoded semver / local when no env is set", async () => {
    vi.stubEnv("APP_VERSION", "");
    vi.stubEnv("ENV_NAME", "");
    const { APP_VERSION, APP_ENVIRONMENT } = await import("./version.js");
    // The fallback tracks the release bump in version.ts, so assert the shape
    // (a semver) rather than a literal that goes stale every release. The dev
    // line carries a `-beta` pre-release suffix, dropped when promoting to main.
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-beta)?$/);
    expect(APP_ENVIRONMENT).toBe("local");
  });

  it("reads APP_VERSION and ENV_NAME from the environment when set", async () => {
    vi.stubEnv("APP_VERSION", "2.3.4");
    vi.stubEnv("ENV_NAME", "beta");
    const { APP_VERSION, APP_ENVIRONMENT } = await import("./version.js");
    expect(APP_VERSION).toBe("2.3.4");
    expect(APP_ENVIRONMENT).toBe("beta");
  });

  it("shortens the build commit to 7 characters", async () => {
    vi.stubEnv("APP_COMMIT", "7d90b17e4c1a9f2b3d5e6a8c0f1234567890abcd");
    const { APP_COMMIT } = await import("./version.js");
    expect(APP_COMMIT).toBe("7d90b17");
  });

  it("leaves the commit empty when the build did not provide one", async () => {
    vi.stubEnv("APP_COMMIT", "");
    const { APP_COMMIT } = await import("./version.js");
    expect(APP_COMMIT).toBe("");
  });
});
