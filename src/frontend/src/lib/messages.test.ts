import { describe, it, expect } from "vitest";

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

// A placeholder that exists in one locale but not the other fails silently:
// next-intl renders the literal text, so the year simply disappears from the
// English page while every check stays green. #357 introduced one such label,
// and `speakers.heading` already relied on the same contract.
const PARAMETERIZED: [string, string][] = [
  ["speakers", "backToList"],
  ["speakers", "heading"],
];

type Messages = Record<string, Record<string, unknown>>;

const locales: [string, Messages][] = [
  ["fr", fr as Messages],
  ["en", en as Messages],
];

describe("translation placeholders", () => {
  it.each(PARAMETERIZED)("%s.%s carries {year} in every locale", (namespace, key) => {
    for (const [name, messages] of locales) {
      const value = messages[namespace]?.[key];
      expect(typeof value, `${name}: ${namespace}.${key} is missing`).toBe("string");
      expect(value as string, `${name}: ${namespace}.${key} lost its {year}`).toContain("{year}");
    }
  });

  it("keeps the news back-link free of the speakers label (#357)", () => {
    // Two namespaces own a `backToList`. Only the speakers one became
    // year-aware; the news link keeps its arrow and its wording.
    for (const [, messages] of locales) {
      expect(messages.articles.backToList as string).not.toContain("{year}");
    }
  });
});

describe("page titles and the brand (#381)", () => {
  // The layout appends " — DevFest Toulouse 2026" to every title. A `pageTitle`
  // that already names the brand therefore ships it twice: /replays read
  // "Replays — toutes les conférences filmées | DevFest Toulouse — DevFest
  // Toulouse 2026", 83 characters, cut by Google mid-repetition.
  it("does not name the brand in a title the template completes", () => {
    for (const [name, messages] of locales) {
      expect(messages.replays.pageTitle as string, `${name}: replays.pageTitle`).not.toMatch(/DevFest/);
    }
  });

  // `bilan.pageTitle` is the exception and stays one: it also labels the
  // breadcrumb, where "DevFest Toulouse 2025" is the right wording. The page
  // opts out of the template with `title.absolute` instead.
  it("keeps the brand in the edition label, which the breadcrumb needs", () => {
    for (const [name, messages] of locales) {
      expect(messages.bilan.pageTitle as string, `${name}: bilan.pageTitle`).toContain("DevFest Toulouse");
    }
  });
});
