import { describe, it, expect } from "vitest";
import { normalizeLocale } from "./edit-link-email.js";

describe("normalizeLocale", () => {
  it("should keep English when explicitly set", () => {
    expect(normalizeLocale("en")).toBe("en");
  });

  it("should keep French when explicitly set", () => {
    expect(normalizeLocale("fr")).toBe("fr");
  });

  // Rows created before #224 carry no locale; they must keep receiving French.
  it("should fall back to French when the locale is missing", () => {
    expect(normalizeLocale(null)).toBe("fr");
    expect(normalizeLocale(undefined)).toBe("fr");
    expect(normalizeLocale("")).toBe("fr");
  });

  it("should fall back to French on an unsupported locale", () => {
    expect(normalizeLocale("de")).toBe("fr");
    expect(normalizeLocale("es")).toBe("fr");
  });

  // An "EN" from an import or a hand-written call must not silently send French
  // mail to an English speaker.
  it("should accept English regardless of case or padding", () => {
    expect(normalizeLocale("EN")).toBe("en");
    expect(normalizeLocale(" en ")).toBe("en");
  });
});
