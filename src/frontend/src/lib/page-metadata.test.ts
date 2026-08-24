import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => (key === "title" ? "DevFest Toulouse 2026" : key),
}));

const { pageMetadata } = await import("./page-metadata");
const { canonicalLocaleFor } = await import("./seo");

describe("pageMetadata (#384)", () => {
  it("points og:url at the page's own URL, not the site root", async () => {
    // The reason this is a per-page builder at all: declaring og:url once in
    // the layout would have every page announce /fr.
    const { openGraph, alternates } = await pageMetadata("fr", "/conferences/mon-talk");

    expect(openGraph?.url).toBe("/fr/conferences/mon-talk");
    expect(openGraph?.url).toBe(alternates?.canonical);
  });

  it("gives the home page the bare locale root", async () => {
    const { alternates, openGraph } = await pageMetadata("en", "");

    expect(alternates?.canonical).toBe("/en");
    expect(openGraph?.url).toBe("/en");
  });

  it("keeps x-default on French whatever the page's own locale", async () => {
    const { alternates } = await pageMetadata("en", "/sponsors");

    expect(alternates?.languages).toEqual({
      fr: "/fr/sponsors",
      en: "/en/sponsors",
      "x-default": "/fr/sponsors",
    });
  });

  it("carries the site-level fields a page used to drop", async () => {
    // og:site_name, og:locale and og:type disappeared from every detail page
    // that declared an openGraph of its own — Next replaces the block, it does
    // not merge it.
    const { openGraph } = await pageMetadata("fr", "/speakers/ada-lovelace");

    expect(openGraph).toMatchObject({
      siteName: "DevFest Toulouse 2026",
      type: "website",
      locale: "fr_FR",
    });
  });

  it("lets a page override the type and add an image", async () => {
    const { openGraph } = await pageMetadata("fr", "/actualites/bilan", {
      type: "article",
      images: [{ url: "/uploads/cover.png" }],
    });

    expect(openGraph).toMatchObject({ type: "article", siteName: "DevFest Toulouse 2026" });
    expect(openGraph?.images).toEqual([{ url: "/uploads/cover.png" }]);
  });
});

describe("a talk lives in one language (#468)", () => {
  const path = "/conferences/pourquoi-rails";

  it("canonicalises the English URL of a French talk onto /fr", async () => {
    const { alternates, openGraph } = await pageMetadata("en", path, {}, "fr");

    expect(alternates?.canonical).toBe(`/fr${path}`);
    expect(openGraph?.url).toBe(`/fr${path}`);
  });

  it("canonicalises the French URL of an English talk onto /en", async () => {
    // The other direction: 18 of the 279 imported talks were given in English.
    const { alternates } = await pageMetadata("fr", path, {}, "en");

    expect(alternates?.canonical).toBe(`/en${path}`);
  });

  it("declares hreflang for that language alone", async () => {
    const { alternates } = await pageMetadata("en", path, {}, "fr");

    expect(alternates?.languages).toEqual({
      fr: `/fr${path}`,
      "x-default": `/fr${path}`,
    });
  });

  it("leaves a bilingual page self-referential", async () => {
    // The non-regression that matters: every other page keeps both variants.
    const { alternates } = await pageMetadata("en", "/sponsors");

    expect(alternates?.canonical).toBe("/en/sponsors");
    expect(Object.keys(alternates?.languages ?? {}).sort()).toEqual(["en", "fr", "x-default"]);
  });
});

describe("canonicalLocaleFor (#468)", () => {
  it.each(["fr", "en"])("reads %s as a locale the site serves", (language) => {
    expect(canonicalLocaleFor(language)).toBe(language);
  });

  it.each([null, undefined, "", "de", "FR"])(
    "has no opinion on %s, leaving the page bilingual",
    (language) => {
      // Canonicalising onto /de would name a URL that does not exist — worse
      // than the duplicate this change removes.
      expect(canonicalLocaleFor(language)).toBeUndefined();
    },
  );
});

describe("no page declares its own openGraph block (#384)", () => {
  // The trap is invisible: `openGraph: { title, description }` looks like an
  // addition and is in fact a replacement, so the page silently loses
  // og:site_name, og:locale, og:type and og:url. Guard the invariant at the
  // source rather than trusting the next reader to know.
  function pageFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) pageFiles(path, out);
      else if (entry.name === "page.tsx") out.push(path);
    }
    return out;
  }

  it("routes every public page through pageMetadata instead", () => {
    const root = join(__dirname, "..", "app", "[locale]");
    const offenders = pageFiles(root).filter((file) =>
      readFileSync(file, "utf8").includes("openGraph:"),
    );

    expect(offenders).toEqual([]);
  });
});
