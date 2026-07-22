import { describe, it, expect } from "vitest";

import { getPublicNavEntries } from "./nav";
import type { Edition } from "./types";

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
    expect(program?.children?.map((c) => c.key)).toEqual(["conferences"]);
    // Not also a flat conferences entry — schedule-ready supersedes it.
    expect(keys(entries)).not.toContain("conferences");
  });

  it("shows Speakers only when the edition has speakers", () => {
    expect(keys(getPublicNavEntries(edition({ hasSpeakers: true })))).toEqual(["speakers", "blog"]);
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
