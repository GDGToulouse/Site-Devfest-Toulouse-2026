import { describe, it, expect, afterEach, vi } from "vitest";

describe("version module", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("defaults to 1.0.0 / local when no env is set", async () => {
    vi.stubEnv("APP_VERSION", "");
    vi.stubEnv("ENV_NAME", "");
    const { APP_VERSION, APP_ENVIRONMENT } = await import("./version.js");
    expect(APP_VERSION).toBe("1.0.0");
    expect(APP_ENVIRONMENT).toBe("local");
  });

  it("reads APP_VERSION and ENV_NAME from the environment when set", async () => {
    vi.stubEnv("APP_VERSION", "2.3.4");
    vi.stubEnv("ENV_NAME", "beta");
    const { APP_VERSION, APP_ENVIRONMENT } = await import("./version.js");
    expect(APP_VERSION).toBe("2.3.4");
    expect(APP_ENVIRONMENT).toBe("beta");
  });
});
