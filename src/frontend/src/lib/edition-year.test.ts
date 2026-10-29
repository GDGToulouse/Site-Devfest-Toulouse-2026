import { describe, it, expect } from "vitest";

import { parseEditionYear } from "./edition-year";

// #703 — `Number()` turned "abc" into NaN and "0x7E9" into 2025: the page then
// asked the backend for /api/editions/NaN, got a 400, and answered 500.
describe("parseEditionYear (#703)", () => {
  it("should read a four-digit year", () => {
    expect(parseEditionYear("2019")).toBe(2019);
  });

  it.each(["abc", "NaN", "", "1.5", "2025.0", "Infinity", "1e3", "0x7E9", " 2025", "-2025", "20250", "999"])(
    "should refuse %j",
    (segment) => {
      expect(parseEditionYear(segment)).toBeNull();
    },
  );

  it("should refuse a missing value", () => {
    expect(parseEditionYear(undefined)).toBeNull();
  });
});
