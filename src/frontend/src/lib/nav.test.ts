import { describe, it, expect } from "vitest";

import { getPublicNavEntries } from "./nav";
import type { Edition } from "./types";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

// getPublicNavEntries drives which public menu links show. Its branches encode
// real rules that have already caused bugs (#203 program nesting, #276 the
// duplicate Sponsors entry / job-offers-only-when-published), so lock them.

// A bare edition with every content flag off. Tests flip only what they need.
// The overrides spread LAST so a flag passed in actually wins over the default —
// getPublicNavEntries only reads these five booleans, so the cast is safe.
function edition(overrides: Partial<Edition> = {}): Edition {
  return {
    isScheduleReady: false,
    isProgramPublished: false,
    hasSpeakers: false,
    hasSponsors: false,
    hasJobOffers: false,
    hasVenueInfo: false,
    ...overrides,
  } as Edition;
}

function keys(entries: ReturnType<typeof getPublicNavEntries>): string[] {
  return entries.map((e) => e.key);
}

describe("getPublicNavEntries", () => {
  it("shows only the blog when nothing is published", () => {
    expect(keys(getPublicNavEntries(edition()))).toEqual(["blog"]);
  });

  it("shows a null edition as blog-only, never crashing", () => {
    expect(keys(getPublicNavEntries(null))).toEqual(["blog"]);
  });

  it("adds a flat Conférences link when the program is published but the schedule isn't ready", () => {
    const entries = getPublicNavEntries(edition({ isProgramPublished: true }));
    expect(keys(entries)).toEqual(["conferences", "blog"]);
    expect(entries[0].children).toBeUndefined();
  });

  it("nests Conférences under a Programme menu once the schedule is ready (#203)", () => {
    const entries = getPublicNavEntries(edition({ isScheduleReady: true, isProgramPublished: true }));
    const program = entries.find((e) => e.key === "program");
    expect(program).toBeDefined();
    // The parent is the grid itself since #106 — it pointed at /conferences
    // while the page did not exist yet.
    expect(program?.href).toBe("/programme");
    expect(program?.children?.map((c) => c.key)).toEqual(["conferences"]);
    // Not also a flat conferences entry — schedule-ready supersedes it.
    expect(keys(entries)).not.toContain("conferences");
  });

  it("shows Speakers only when the edition has speakers", () => {
    expect(keys(getPublicNavEntries(edition({ hasSpeakers: true })))).toEqual(["speakers", "blog"]);
  });

  it("nests the hall of fame under Speakers (#369)", () => {
    const entries = getPublicNavEntries(edition({ hasSpeakers: true }));
    const speakers = entries.find((e) => e.key === "speakers");
    expect(speakers?.children?.map((c) => c.key)).toEqual(["hall-of-fame"]);
    // Under the parent, not beside it: a second top-level entry is what #276
    // cost us on Sponsors.
    expect(keys(entries)).not.toContain("hall-of-fame");
  });

  it("shows Sponsors without a submenu when there are no job offers", () => {
    const entries = getPublicNavEntries(edition({ hasSponsors: true }));
    const sponsors = entries.find((e) => e.key === "sponsors");
    expect(sponsors?.children).toBeUndefined();
  });

  it("adds the job-offers submenu only when offers are published (#276)", () => {
    const entries = getPublicNavEntries(edition({ hasSponsors: true, hasJobOffers: true }));
    const sponsors = entries.find((e) => e.key === "sponsors");
    expect(sponsors?.children?.map((c) => c.key)).toEqual(["job-offers"]);
    // No duplicate top-level entry — the #276 bug was a doubled Sponsors link.
    expect(keys(entries).filter((k) => k === "sponsors")).toHaveLength(1);
  });

  it("shows the venue link only when the edition has venue info (#109)", () => {
    expect(keys(getPublicNavEntries(edition()))).not.toContain("venue");
    expect(keys(getPublicNavEntries(edition({ hasVenueInfo: true })))).toEqual(["venue", "blog"]);
  });

  // A labelKey with no entry under the `nav` namespace renders as the raw key:
  // the header shipped "nav.hallOfFame" to visitors while every structural test
  // stayed green, because they all assert the key and never its translation.
  // Caught in the browser, not here — hence this (#369).
  it("gives every entry and child a label in both locales", () => {
    const entries = getPublicNavEntries(
      edition({
        isScheduleReady: true,
        isProgramPublished: true,
        hasSpeakers: true,
        hasSponsors: true,
        hasJobOffers: true,
        hasVenueInfo: true,
      }),
    );
    const labelKeys = entries.flatMap((e) => [
      e.labelKey,
      ...(e.children?.map((c) => c.labelKey) ?? []),
    ]);

    for (const [name, messages] of [["fr", fr], ["en", en]] as const) {
      const nav = messages.nav as Record<string, string | undefined>;
      for (const key of labelKeys) {
        expect(nav[key], `${name}: nav.${key} is missing`).toBeTruthy();
      }
    }
  });

  it("orders entries program → speakers → sponsors → venue → blog", () => {
    const entries = getPublicNavEntries(
      edition({
        isProgramPublished: true,
        hasSpeakers: true,
        hasSponsors: true,
        hasVenueInfo: true,
      }),
    );
    expect(keys(entries)).toEqual(["conferences", "speakers", "sponsors", "venue", "blog"]);
  });
});
