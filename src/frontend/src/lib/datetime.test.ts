import { describe, it, expect } from "vitest";

import { isoToLocalInput, localInputToIso, isoToLocalTime } from "./datetime";

// The bug these lock down (#105): the talk editor loaded `startsAt` by slicing
// the ISO string, which handed the datetime-local input a UTC wall-clock. The
// input reads local, so saving converted it a second time and the start moved
// back by the timezone offset — an hour, every save, silently.
//
// Nothing pins a timezone for these tests, and pinning one would weaken them:
// in UTC the old sliced version passes. So nothing is asserted against a
// literal local string — only that loading then saving changes nothing, which
// has to hold in every zone, CI's included.

describe("datetime-local round trip", () => {
  it("returns the same instant after a load/save cycle", () => {
    const original = "2026-11-19T08:00:00.000Z";
    const backToApi = localInputToIso(isoToLocalInput(original));
    expect(backToApi).toBe(original);
  });

  it("survives repeated cycles — the drift was cumulative", () => {
    let value = "2026-11-19T08:00:00.000Z";
    for (let i = 0; i < 5; i++) {
      value = localInputToIso(isoToLocalInput(value))!;
    }
    expect(value).toBe("2026-11-19T08:00:00.000Z");
  });

  it("hands the input a value it can actually parse back", () => {
    const local = isoToLocalInput("2026-11-19T08:00:00.000Z");
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(local).toISOString()).toBe("2026-11-19T08:00:00.000Z");
  });

  it("treats an absent or unparseable value as empty rather than NaN", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput("pas une date")).toBe("");
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("pas une date")).toBeNull();
  });

  it("reads a schedule time as hours and minutes", () => {
    expect(isoToLocalTime("2026-11-19T08:00:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});
