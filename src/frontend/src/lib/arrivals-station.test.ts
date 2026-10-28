import { describe, it, expect, beforeEach } from "vitest";

import { readStation, recallArrivalsEdition, rememberArrivalsEdition, saveStation, stationLabel } from "./arrivals-station";

describe("the station a device works as (RG-ARR-25, #641)", () => {
  beforeEach(() => window.localStorage.clear());

  it("should reopen on the station chosen last", () => {
    saveStation({ kind: "counter", counter: 2, bin: 3 });

    expect(readStation()).toEqual({ kind: "counter", counter: 2, bin: 3 });
  });

  it("should forget the station when asked to change", () => {
    saveStation({ kind: "scan" });
    saveStation(null);

    expect(readStation()).toBeNull();
  });

  it("should ask again rather than trust a stored value it does not recognize", () => {
    window.localStorage.setItem("devfest-arrivals-station", JSON.stringify({ kind: "counter", counter: "2" }));

    expect(readStation()).toBeNull();
  });

  it("should name the station as the volunteers say it", () => {
    expect(stationLabel({ kind: "counter", counter: 2, bin: null })).toBe("Guichet 2");
    expect(stationLabel({ kind: "counter", counter: 2, bin: 3 })).toBe("Guichet 2 · bac 3");
  });

  it("should remember the edition it was let into, for when the backend is down", () => {
    rememberArrivalsEdition({ id: 7, year: 2026 });

    expect(recallArrivalsEdition()).toEqual({ id: 7, year: 2026 });
  });
});
