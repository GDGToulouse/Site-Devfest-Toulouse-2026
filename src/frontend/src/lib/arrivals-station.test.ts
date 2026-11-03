import { describe, it, expect, beforeEach } from "vitest";

import {
  isSameStation,
  isStationInLayout,
  parseStationNumber,
  recallArrivalsEdition,
  rememberArrivalsEdition,
  stationLabel,
  stationPath,
} from "./arrivals-station";

describe("the station a screen works as (RG-ARR-25, #641, #775)", () => {
  beforeEach(() => window.localStorage.clear());

  it("should give every station its own address, one per counter", () => {
    expect(stationPath({ kind: "scan" })).toBe("/arrivees/scan");
    expect(stationPath({ kind: "help" })).toBe("/arrivees/aide");
    expect(stationPath({ kind: "counter", counter: 2 })).toBe("/arrivees/guichet/2");
  });

  it("should read a counter number from 1 to 9 only (#774)", () => {
    expect(["1", "9"].map(parseStationNumber)).toEqual([1, 9]);
    expect(["0", "10", "2x", "-1", "", undefined].map(parseStationNumber)).toEqual([null, null, null, null, null, null]);
  });

  it("should tell whether the edition has the station an address names", () => {
    const layout = { counters: 4 };

    expect(isStationInLayout({ kind: "counter", counter: 4 }, layout)).toBe(true);
    expect(isStationInLayout({ kind: "counter", counter: 5 }, layout)).toBe(false);
    expect(isStationInLayout({ kind: "scan" }, layout)).toBe(true);
  });

  it("should tell one counter from another", () => {
    expect(isSameStation({ kind: "counter", counter: 2 }, { kind: "counter", counter: 3 })).toBe(false);
    expect(isSameStation({ kind: "counter", counter: 2 }, { kind: "counter", counter: 2 })).toBe(true);
    expect(isSameStation({ kind: "scan" }, { kind: "help" })).toBe(false);
  });

  it("should name the station as the volunteers say it", () => {
    expect(stationLabel({ kind: "counter", counter: 2 })).toBe("Guichet 2");
  });

  it("should remember the edition it was let into, for when the backend is down", () => {
    rememberArrivalsEdition({ id: 7, year: 2026 });

    expect(recallArrivalsEdition()).toEqual({ id: 7, year: 2026 });
  });
});
