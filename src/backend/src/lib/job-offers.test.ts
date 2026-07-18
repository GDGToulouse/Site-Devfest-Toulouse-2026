import { describe, it, expect } from "vitest";
import { offerQuotaForLevel, areOffersVisible, offersVisibilityCutoff } from "./job-offers.js";

// Quota per level and the one-month-after-the-event visibility window (#251).

describe("offerQuotaForLevel", () => {
  it("gives 4 to Platinum, 2 to Gold, 1 to the rest", () => {
    expect(offerQuotaForLevel("PLATINUM")).toBe(4);
    expect(offerQuotaForLevel("GOLD")).toBe(2);
    expect(offerQuotaForLevel("SILVER")).toBe(1);
    expect(offerQuotaForLevel("SOUTIEN")).toBe(1);
    expect(offerQuotaForLevel("COMMUNAUTE")).toBe(1);
  });

  it("defaults to 1 for an unknown level", () => {
    expect(offerQuotaForLevel("MYSTERY")).toBe(1);
  });
});

describe("offers visibility window", () => {
  const start = new Date("2026-11-19T09:00:00Z");
  const end = new Date("2026-11-19T18:00:00Z");

  it("stays visible up to one month after the end date", () => {
    const cutoff = offersVisibilityCutoff({ startDate: start, endDate: end });
    expect(cutoff).not.toBeNull();
    // Just before the cutoff → visible.
    expect(areOffersVisible({ startDate: start, endDate: end }, new Date("2026-12-15T00:00:00Z"))).toBe(true);
    // Well after → hidden.
    expect(areOffersVisible({ startDate: start, endDate: end }, new Date("2027-01-15T00:00:00Z"))).toBe(false);
  });

  it("falls back to the start date when there is no end date", () => {
    expect(areOffersVisible({ startDate: start, endDate: null }, new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(areOffersVisible({ startDate: start, endDate: null }, new Date("2027-02-01T00:00:00Z"))).toBe(false);
  });

  it("is always visible when the event isn't scheduled yet", () => {
    expect(offersVisibilityCutoff({ startDate: null, endDate: null })).toBeNull();
    expect(areOffersVisible({ startDate: null, endDate: null })).toBe(true);
  });
});
