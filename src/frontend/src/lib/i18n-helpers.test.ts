import { describe, it, expect } from "vitest";

import { localizedField } from "./i18n-helpers";

// localizedField takes `obj: any`, which is exactly why it once silently blanked
// every conference title: after #293 renamed titleFr/titleEn to `title`, the
// callers still asked for "title" and got "" with no type error and no crash.
// These lock its contract so that failure mode is at least visible in a test.

describe("localizedField", () => {
  const obj = { nameFr: "Bonjour", nameEn: "Hello", descriptionFr: "Salut" };

  it("reads the Fr field for the fr locale", () => {
    expect(localizedField(obj, "name", "fr")).toBe("Bonjour");
  });

  it("reads the En field for the en locale", () => {
    expect(localizedField(obj, "name", "en")).toBe("Hello");
  });

  it("treats any non-en locale as fr", () => {
    // The suffix is "En" only for "en"; everything else falls back to "Fr".
    expect(localizedField(obj, "name", "de")).toBe("Bonjour");
  });

  it("returns an empty string when the field is missing, not undefined", () => {
    // This is the #293 trap: a wrong/renamed field name yields "" silently. The
    // empty string is the documented fallback — assert it explicitly so a future
    // change to throw-on-missing would be a conscious decision, not a surprise.
    expect(localizedField(obj, "title", "fr")).toBe("");
  });

  it("falls back to empty when only the other locale is present", () => {
    expect(localizedField(obj, "description", "en")).toBe("");
  });
});
