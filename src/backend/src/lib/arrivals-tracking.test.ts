import { describe, it, expect } from "vitest";

import { summarize, type TrackingRow } from "./arrivals-tracking.js";

const row = (overrides: Partial<TrackingRow>): TrackingRow => ({
  badgeNumber: null,
  badgeState: "PRINTED",
  isDedicated: false,
  isScanned: false,
  isLabelDelivered: false,
  ...overrides,
});

describe("the tracking screen's totals (#644)", () => {
  it("should count each counter's columns, and what waits across them", () => {
    const summary = summarize(
      [
        row({ badgeNumber: 1000 }),
        row({ badgeNumber: 1001, badgeState: "TO_FETCH", isScanned: true }),
        row({ badgeNumber: 1100, badgeState: "READY", isScanned: true }),
        row({ badgeNumber: 2000, badgeState: "DELIVERED", isScanned: true }),
      ],
      2,
      0,
    );

    expect(summary).toMatchObject({ expected: 4, scanned: 3, delivered: 1, waiting: 2 });
    expect(summary.counters).toEqual([
      { counter: 1, numbered: 3, toFetch: 1, ready: 1, delivered: 0 },
      { counter: 2, numbered: 1, toFetch: 0, ready: 0, delivered: 1 },
    ]);
  });

  it("should count the dedicated flow apart from what the counters expect", () => {
    const summary = summarize(
      [row({ isDedicated: true, isScanned: true }), row({ isDedicated: true }), row({ badgeNumber: 1000 })],
      1,
      0,
    );

    expect(summary.dedicated).toEqual({ expected: 2, scanned: 1 });
    expect(summary.expected).toBe(1);
  });

  it("should count the help desk's labels apart, off the counters' bars", () => {
    const summary = summarize(
      [
        row({ isScanned: true }),
        row({ isScanned: true, isLabelDelivered: true }),
        row({ badgeNumber: 1000, badgeState: "DELIVERED", isScanned: true, isLabelDelivered: true }),
      ],
      1,
      3,
    );

    expect(summary.help).toEqual({ toHandle: 1, labelsDelivered: 2, labelsPrinted: 3 });
    expect(summary.delivered).toBe(2);
    expect(summary.counters[0]).toEqual({ counter: 1, numbered: 0, toFetch: 0, ready: 0, delivered: 0 });
  });
});
