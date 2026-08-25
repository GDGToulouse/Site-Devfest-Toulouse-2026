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

  // The home page is the second `title.absolute`: it names the brand on
  // purpose, so the template must not add it again. Once, and only once.
  it("names the brand exactly once on the home page", () => {
    for (const [name, messages] of locales) {
      const title = messages.home.pageTitle as string;
      expect(title.match(/DevFest Toulouse/g), `${name}: home.pageTitle`).toHaveLength(1);
      // Google cuts around 60. The page used to fall back on the layout's
      // 21-character default; the answer is not to overshoot the other way.
      expect(title.length, `${name}: home.pageTitle is ${title.length} characters`).toBeLessThanOrEqual(60);
    }
  });
});

describe("page descriptions (#381)", () => {
  // Every public page must carry one in both languages. The tag pages were the
  // single exception — a title and nothing else.
  it("leaves no description empty in either locale", () => {
    const empty: string[] = [];
    for (const [name, messages] of locales) {
      for (const [namespace, values] of Object.entries(messages)) {
        const description = (values as Record<string, unknown>).description;
        if (typeof description === "string" && description.trim() === "") {
          empty.push(`${name}: ${namespace}.description`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  // The pages worth ranking for. Not the legal ones: "Mentions légales du site
  // DevFest Toulouse" is 42 characters in French and 30 in English, and that is
  // the right length — padding a legal notice to 150 buys nothing.
  const MAIN_PAGES = ["articles", "ticketing", "bilan", "contact", "cfp", "sponsor"];

  it.each(MAIN_PAGES)("gives %s a description in the useful range", (namespace) => {
    // Google shows roughly 150-160. The French side sat at 39-67 characters
    // while the English had had a real SEO pass — the wrong way round for a
    // Toulouse event whose x-default points at /fr.
    for (const [name, messages] of locales) {
      const description = messages[namespace].description as string;
      expect(description.length, `${name}: ${namespace}.description is ${description.length}`)
        .toBeGreaterThanOrEqual(120);
      expect(description.length, `${name}: ${namespace}.description is ${description.length}`)
        .toBeLessThanOrEqual(160);
    }
  });

  it("describes a tag page, naming the tag", () => {
    for (const [name, messages] of locales) {
      expect(messages.articles.tagDescription as string, `${name}: articles.tagDescription`).toContain("{tag}");
    }
  });
});
