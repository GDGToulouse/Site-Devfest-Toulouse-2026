import { describe, it, expect } from "vitest";
import { mostRecent } from "./lastmod.js";

const OLD = new Date("2026-01-01T00:00:00Z");
const RECENT = new Date("2026-06-01T00:00:00Z");

describe("mostRecent", () => {
  it("returns the latest of several dates", () => {
    expect(mostRecent(OLD, RECENT)).toEqual(RECENT);
  });

  it("ignores the argument order", () => {
    expect(mostRecent(RECENT, OLD)).toEqual(RECENT);
  });

  it("skips null and undefined", () => {
    // A sponsor with no published participation yet: the company's own date
    // still dates its page.
    expect(mostRecent(OLD, null, undefined)).toEqual(OLD);
  });

  it("returns null when no date is known", () => {
    // Better no lastmod at all than a made-up one.
    expect(mostRecent(null, undefined)).toBeNull();
  });
});
