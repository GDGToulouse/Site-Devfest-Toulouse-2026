import { describe, it, expect } from "vitest";

import { generateApiKey, verifyApiKey, extractPrefix, resolveApiKeyEnv } from "./api-key.js";

describe("generateApiKey", () => {
  it("produces a key matching the expected shape", async () => {
    const { raw, prefix, hashedKey } = await generateApiKey("dev");
    expect(raw.startsWith("dft_dev_")).toBe(true);
    expect(raw.length).toBeGreaterThan(32);
    expect(prefix).toBe(raw.slice(0, "dft_dev_".length + 12));
    expect(hashedKey.startsWith("$argon2id$")).toBe(true);
  });

  it("produces distinct keys on each call", async () => {
    const a = await generateApiKey("dev");
    const b = await generateApiKey("dev");
    expect(a.raw).not.toBe(b.raw);
    expect(a.hashedKey).not.toBe(b.hashedKey);
  });

  it("respects the requested environment segment", async () => {
    const live = await generateApiKey("live");
    const beta = await generateApiKey("beta");
    expect(live.raw.startsWith("dft_live_")).toBe(true);
    expect(beta.raw.startsWith("dft_beta_")).toBe(true);
  });
});

describe("verifyApiKey", () => {
  it("accepts the matching raw key", async () => {
    const { raw, hashedKey } = await generateApiKey("dev");
    expect(await verifyApiKey(raw, hashedKey)).toBe(true);
  });

  it("rejects a different raw key", async () => {
    const { hashedKey } = await generateApiKey("dev");
    const { raw: otherRaw } = await generateApiKey("dev");
    expect(await verifyApiKey(otherRaw, hashedKey)).toBe(false);
  });

  it("rejects a tampered key without throwing", async () => {
    const { raw, hashedKey } = await generateApiKey("dev");
    const tampered = raw.slice(0, -4) + "XXXX";
    expect(await verifyApiKey(tampered, hashedKey)).toBe(false);
  });
});

describe("extractPrefix", () => {
  it("returns the public prefix of a well-formed key", async () => {
    const { raw, prefix } = await generateApiKey("dev");
    expect(extractPrefix(raw)).toBe(prefix);
  });

  it("returns null for malformed keys", () => {
    expect(extractPrefix("not-a-key")).toBeNull();
    expect(extractPrefix("dft_live_")).toBeNull();
    expect(extractPrefix("dft_staging_abc")).toBeNull();
  });
});

describe("resolveApiKeyEnv", () => {
  it("returns dev outside of production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    expect(resolveApiKeyEnv()).toBe("dev");
    process.env.NODE_ENV = prev;
  });

  it("returns beta when BASE_URL contains beta.", () => {
    const prevNode = process.env.NODE_ENV;
    const prevBase = process.env.BASE_URL;
    process.env.NODE_ENV = "production";
    process.env.BASE_URL = "https://beta.site.devfesttoulouse.fr";
    expect(resolveApiKeyEnv()).toBe("beta");
    process.env.NODE_ENV = prevNode;
    process.env.BASE_URL = prevBase;
  });

  it("returns live in production otherwise", () => {
    const prevNode = process.env.NODE_ENV;
    const prevBase = process.env.BASE_URL;
    process.env.NODE_ENV = "production";
    process.env.BASE_URL = "https://devfesttoulouse.fr";
    expect(resolveApiKeyEnv()).toBe("live");
    process.env.NODE_ENV = prevNode;
    process.env.BASE_URL = prevBase;
  });
});
