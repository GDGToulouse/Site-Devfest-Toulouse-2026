import { describe, it, expect } from "vitest";

import { encodeStation, isBadgeInScope, listStations, parseStation, stationName, stationPath, stationWindow } from "./arrivals-station.js";

describe("Station codes", () => {
  it("should round-trip every station of a layout", () => {
    const stations = listStations({ counters: 3, binsPerCounter: 2 });

    expect(stations.map((s) => parseStation(encodeStation(s)))).toEqual(stations);
    expect(stations).toHaveLength(2 + 3 * (1 + 2));
  });

  it("should refuse a code that names no station", () => {
    expect(["c0", "c10", "c1b0", "guichet", ""].map(parseStation)).toEqual([null, null, null, null, null]);
  });

  it("should name stations the way the team does, and give their screen's address", () => {
    expect(stationName({ kind: "counter", counter: 2, bin: 1 })).toBe("Guichet 2 · présentoir 1");
    expect(stationPath({ kind: "counter", counter: 2, bin: 1 })).toBe("/arrivees/guichet/2/presentoir/1");
    expect(stationPath({ kind: "help" })).toBe("/arrivees/aide");
  });
});

describe("A counter station's badges", () => {
  it("should cover its counter, narrowed to a bin when it has one", () => {
    expect(isBadgeInScope({ kind: "counter", counter: 2, bin: null }, 2147)).toBe(true);
    expect(isBadgeInScope({ kind: "counter", counter: 2, bin: 1 }, 2147)).toBe(true);
    expect(isBadgeInScope({ kind: "counter", counter: 2, bin: 2 }, 2147)).toBe(false);
    expect(isBadgeInScope({ kind: "counter", counter: 1, bin: null }, 2147)).toBe(false);
    expect(isBadgeInScope({ kind: "scan" }, 2147)).toBe(false);
  });
});

describe("The default window (RG-ARR-71)", () => {
  const unset = { stationAccessFrom: null, stationAccessUntil: null };

  it("should run from midnight the day before the event through its last day, Paris time", () => {
    const { from, until } = stationWindow({
      startDate: new Date("2026-11-19T00:00:00Z"),
      endDate: new Date("2026-11-19T00:00:00Z"),
      ...unset,
    });

    // November: Paris is UTC+1.
    expect(from?.toISOString()).toBe("2026-11-17T23:00:00.000Z");
    expect(until?.toISOString()).toBe("2026-11-19T22:59:59.000Z");
  });

  it("should end on the last day of a multi-day event", () => {
    const { until } = stationWindow({
      startDate: new Date("2026-11-19T00:00:00Z"),
      endDate: new Date("2026-11-20T00:00:00Z"),
      ...unset,
    });

    expect(until?.toISOString()).toBe("2026-11-20T22:59:59.000Z");
  });

  it("should prefer what the admin set, side by side", () => {
    const set = new Date("2026-11-18T08:00:00Z");

    const { from, until } = stationWindow({
      startDate: new Date("2026-11-19T00:00:00Z"),
      endDate: null,
      stationAccessFrom: set,
      stationAccessUntil: null,
    });

    expect(from).toEqual(set);
    expect(until?.toISOString()).toBe("2026-11-19T22:59:59.000Z");
  });

  it("should stay closed with no event date and nothing set", () => {
    expect(stationWindow({ startDate: null, endDate: null, ...unset })).toEqual({ from: null, until: null });
  });
});
