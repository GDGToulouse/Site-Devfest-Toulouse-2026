import { describe, it, expect, vi, afterEach } from "vitest";
import type { ScheduleRow } from "./schedule";
import { nextSlot, parseSimulatedNow } from "./next-slot";

// #575 — the button leads to the next row that starts, on the day only.

const talk = (startsAt: string, endsAt: string) => ({ talk: { startsAt, endsAt }, isSimulcast: false, rowSpan: 1 });
const rows = [
  { type: "band", key: "band:breakfast", startsAt: "2026-11-19T07:00:00.000Z", entry: { startsAt: "2026-11-19T07:00:00.000Z", endsAt: "2026-11-19T07:45:00.000Z" } },
  { type: "slot", key: "slot:0950", startsAt: "2026-11-19T08:50:00.000Z", cells: [[talk("2026-11-19T08:50:00.000Z", "2026-11-19T09:35:00.000Z")]], covered: [false] },
  { type: "band", key: "band:break", startsAt: "2026-11-19T09:35:00.000Z", entry: { startsAt: "2026-11-19T09:35:00.000Z", endsAt: "2026-11-19T10:00:00.000Z" } },
  { type: "slot", key: "slot:1100", startsAt: "2026-11-19T10:00:00.000Z", cells: [[talk("2026-11-19T10:00:00.000Z", "2026-11-19T10:45:00.000Z")]], covered: [false] },
] as unknown as ScheduleRow[];

describe("nextSlot (#575)", () => {
  it("should lead to the next row that starts, a break included", () => {
    expect(nextSlot(rows, new Date("2026-11-19T09:20:00.000Z"))).toEqual({ key: "band:break", startsAt: "2026-11-19T09:35:00.000Z" });
  });

  it("should not exist before the first slot of the day", () => {
    expect(nextSlot(rows, new Date("2026-11-19T06:30:00.000Z"))).toBeNull();
  });

  it("should not exist once nothing is left to start", () => {
    expect(nextSlot(rows, new Date("2026-11-19T10:20:00.000Z"))).toBeNull();
  });

  it("should not exist with nothing shown", () => {
    expect(nextSlot([], new Date("2026-11-19T09:20:00.000Z"))).toBeNull();
  });
});

describe("parseSimulatedNow (#575)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("should read the given time as Toulouse time", () => {
    expect(parseSimulatedNow("2026-11-19T10:20")?.toISOString()).toBe("2026-11-19T09:20:00.000Z");
  });

  it("should follow summer time", () => {
    expect(parseSimulatedNow("2026-06-18T10:20")?.toISOString()).toBe("2026-06-18T08:20:00.000Z");
  });

  it("should read Toulouse time on a browser set to another zone", async () => {
    vi.resetModules();
    vi.stubEnv("TZ", "America/New_York");
    const { parseSimulatedNow: elsewhere } = await import("./next-slot");

    expect(elsewhere("2026-11-19T10:20")?.toISOString()).toBe("2026-11-19T09:20:00.000Z");
  });

  it("should ignore anything else", () => {
    expect(parseSimulatedNow(null)).toBeNull();
    expect(parseSimulatedNow("demain")).toBeNull();
  });
});
