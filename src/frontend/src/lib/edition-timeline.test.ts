import { describe, it, expect } from "vitest";
import type { EditionSummary } from "./types";
import { buildTimeline } from "./edition-timeline";

// #104 — the timeline reads newest first, with the coming edition on top and
// a marker for the years without a DevFest.

const edition = (year: number, status: EditionSummary["status"] = "SEE_YOU_NEXT_YEAR") =>
  ({ id: year, year, status, startDate: `${year}-11-01T00:00:00.000Z`, venueName: "Diagora", archivedSiteUrl: null, updatedAt: "" }) as EditionSummary;

describe("buildTimeline (#104)", () => {
  it("should put the coming edition on top and mark the years without one", () => {
    const steps = buildTimeline([edition(2016), edition(2019), edition(2023), edition(2026, "ANNOUNCEMENT"), edition(2025)]);

    expect(steps.map((s) => (s.type === "gap" ? `${s.from}-${s.to}` : s.year))).toEqual([2026, 2025, "2024-2024", 2023, "2020-2022", 2019, "2017-2018", 2016]);
    expect(steps[0]).toMatchObject({ isUpcoming: true });
    expect(steps.at(-1)).toMatchObject({ year: 2016, isFirst: true });
  });

  it("should leave out an edition still in preparation for a year already held", () => {
    const steps = buildTimeline([edition(2025), edition(2024, "PREPARATION")]);

    expect(steps.map((s) => (s.type === "edition" ? s.year : "gap"))).toEqual([2025]);
  });

  it("should show nothing without any edition", () => {
    expect(buildTimeline([])).toEqual([]);
  });
});
