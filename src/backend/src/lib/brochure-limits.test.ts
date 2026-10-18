import { describe, expect, it } from "vitest";

import { BROCHURE_IP_MAX, brochureIpRetryAfter, claimAddress, consumeBrochureIpBudget } from "./brochure-limits.js";

const HOUR = 60 * 60 * 1000;

describe("brochure IP budget (#662)", () => {
  it("should give an IP three requests, then refuse until the hour is over", () => {
    const start = 1_000_000;
    const answers = Array.from({ length: BROCHURE_IP_MAX + 1 }, () => consumeBrochureIpBudget("203.0.113.1", start));
    const justBefore = consumeBrochureIpBudget("203.0.113.1", start + HOUR - 1);
    const after = consumeBrochureIpBudget("203.0.113.1", start + HOUR);

    expect(answers).toEqual([true, true, true, false]);
    expect(justBefore).toBe(false);
    expect(after).toBe(true);
  });

  it("should say how long to wait", () => {
    const start = 5_000_000;
    consumeBrochureIpBudget("203.0.113.2", start);

    expect(brochureIpRetryAfter("203.0.113.2", start + 10 * 60 * 1000)).toBe(50 * 60);
  });
});

describe("brochure address claim (#662)", () => {
  it("should hold an address for one request at a time, whatever its case", () => {
    const release = claimAddress("Ada@Example.test");

    expect(claimAddress("ada@example.test")).toBeNull();
    release?.();
    expect(claimAddress("ada@example.test")).not.toBeNull();
  });
});
