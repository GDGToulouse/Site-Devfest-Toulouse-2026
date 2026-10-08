import { describe, it, expect, vi, afterEach } from "vitest";

import {
  isoToLocalInput,
  localInputToIso,
  formatEventTime,
  formatEventDuration,
  daysUntilEvent,
} from "./datetime";

// The bug these lock down (#105): the talk editor loaded `startsAt` by slicing
// the ISO string, which handed the datetime-local input a UTC wall-clock. The
// input reads local, so saving converted it a second time and the start moved
// back by the timezone offset — an hour, every save, silently.
//
// The round-trip assertions below never name a literal local hour: loading then
// saving must change nothing, and that has to hold in every zone. The suite
// runs on `TZ=Europe/Paris` (vitest.config.ts) because the sliced version does
// pass under a zero offset, so a UTC runner could not tell the two apart.

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

});

describe("schedule times (#106)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads a session time as hours and minutes, on the Toulouse clock", () => {
    expect(formatEventTime("2026-11-19T08:50:00.000Z")).toBe("09:50");
  });

  it("says Toulouse time even when the server itself runs on UTC", async () => {
    // This is not hypothetical: the frontend container has no TZ, so the grid
    // is rendered by a process on UTC and printed 08:50 for the session the
    // signage calls 09:50. The zone has to be in the formatter, not inherited.
    vi.resetModules();
    vi.stubEnv("TZ", "UTC");
    const { formatEventTime: onUtcServer } = await import("./datetime");

    expect(onUtcServer("2026-11-19T08:50:00.000Z")).toBe("09:50");
  });

  it("follows summer time — the offset is not a constant", () => {
    // A June rehearsal or a spring meetup runs on CEST (+2), not CET (+1).
    expect(formatEventTime("2026-06-18T08:50:00.000Z")).toBe("10:50");
  });

  it("treats an unparseable value as empty rather than printing NaN", () => {
    expect(formatEventTime("pas une date")).toBe("");
  });
});

describe("session duration (#457)", () => {
  it("gives the length of a conference in minutes", () => {
    expect(formatEventDuration("2026-11-19T08:50:00.000Z", "2026-11-19T09:30:00.000Z")).toBe(
      "40 min",
    );
  });

  it("separates a quickie from a conference — the point of showing it at all", () => {
    // Both start at 09:50 and the row header says so; the duration is the only
    // thing left on the card that tells the two apart.
    expect(formatEventDuration("2026-11-19T08:50:00.000Z", "2026-11-19T09:10:00.000Z")).toBe(
      "20 min",
    );
  });

  it("stays in minutes past the hour, so no locale has to spell the unit", () => {
    expect(formatEventDuration("2026-11-19T08:00:00.000Z", "2026-11-19T09:30:00.000Z")).toBe(
      "90 min",
    );
  });

  it("says nothing when the talk has no end — 244 imported talks have none", () => {
    expect(formatEventDuration("2026-11-19T08:50:00.000Z", null)).toBeNull();
  });

  it("says nothing rather than a negative or empty span", () => {
    expect(formatEventDuration("2026-11-19T09:30:00.000Z", "2026-11-19T08:50:00.000Z")).toBeNull();
    expect(formatEventDuration("2026-11-19T08:50:00.000Z", "pas une date")).toBeNull();
  });
});

describe("days until the event (#576)", () => {
  // The edition stores its first day as midnight UTC, as the admin date field saves it.
  const START = "2026-11-19T00:00:00.000Z";

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("counts whole days on the Toulouse calendar", () => {
    expect(daysUntilEvent(START, new Date("2026-10-27T10:00:00.000Z"))).toBe(23);
  });

  it("says tomorrow late the evening before, not today", () => {
    // 23:30 in Toulouse on the 18th: fewer than 24 hours left, still the day before.
    expect(daysUntilEvent(START, new Date("2026-11-18T22:30:00.000Z"))).toBe(1);
  });

  it("is 0 on the day itself, from just after midnight in Toulouse", () => {
    expect(daysUntilEvent(START, new Date("2026-11-18T23:05:00.000Z"))).toBe(0);
  });

  it("goes negative once the day is over", () => {
    expect(daysUntilEvent(START, new Date("2026-11-20T08:00:00.000Z"))).toBe(-1);
  });

  it("keeps the Toulouse calendar on a browser set to another zone", async () => {
    vi.resetModules();
    vi.stubEnv("TZ", "America/New_York");
    const { daysUntilEvent: elsewhere } = await import("./datetime");

    // 18:30 on the 18th in New York is already the 19th in Toulouse.
    expect(elsewhere(START, new Date("2026-11-18T23:30:00.000Z"))).toBe(0);
  });

  it("says nothing for an unparseable date", () => {
    expect(daysUntilEvent("pas une date", new Date())).toBeNull();
  });
});
