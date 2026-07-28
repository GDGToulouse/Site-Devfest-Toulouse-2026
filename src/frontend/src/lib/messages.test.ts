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
