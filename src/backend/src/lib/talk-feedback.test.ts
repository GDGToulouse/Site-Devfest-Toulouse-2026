import { describe, it, expect } from "vitest";
import { feedbackPhase, feedbackWindow, isTestVote, publicTrend } from "./talk-feedback.js";

// #564 — votes open the day of the event and the next, on Paris clocks; the
// public trend needs five votes and shows positive appreciations only.

const EDITION = { startDate: new Date("2026-11-19T00:00:00.000Z"), endDate: new Date("2026-11-19T00:00:00.000Z") };

describe("feedbackWindow", () => {
  it("should open at midnight in Paris on the event day and close two days later", () => {
    expect(feedbackWindow(EDITION)).toEqual({
      opensAt: new Date("2026-11-18T23:00:00.000Z"),
      closesAt: new Date("2026-11-20T23:00:00.000Z"),
    });
  });

  it("should count the next day from the last day of a multi-day edition", () => {
    expect(feedbackWindow({ ...EDITION, endDate: new Date("2026-11-20T00:00:00.000Z") })?.closesAt).toEqual(
      new Date("2026-11-21T23:00:00.000Z"),
    );
  });

  it("should give no window to an edition without a date", () => {
    expect(feedbackWindow({ startDate: null, endDate: null })).toBeNull();
  });
});

describe("feedbackPhase", () => {
  it("should be upcoming one minute before midnight in Paris", () => {
    expect(feedbackPhase(EDITION, new Date("2026-11-18T22:59:00.000Z"))).toBe("upcoming");
  });

  it("should be open at midnight in Paris on the event day", () => {
    expect(feedbackPhase(EDITION, new Date("2026-11-18T23:00:00.000Z"))).toBe("open");
  });

  it("should still be open late on the day after", () => {
    expect(feedbackPhase(EDITION, new Date("2026-11-20T22:59:00.000Z"))).toBe("open");
  });

  it("should be closed from midnight after the day after", () => {
    expect(feedbackPhase(EDITION, new Date("2026-11-20T23:00:00.000Z"))).toBe("closed");
  });
});

describe("publicTrend", () => {
  const votes = (n: number, items: string[]) => Array.from({ length: n }, () => ({ items }));

  it("should show nothing under five votes", () => {
    expect(publicTrend(votes(4, ["learned"]))).toBeNull();
  });

  it("should give the three most ticked positive appreciations as a share of the votes", () => {
    const trend = publicTrend([
      ...votes(3, ["learned", "interesting", "fun"]),
      ...votes(2, ["learned", "speaker"]),
    ]);
    expect(trend).toEqual([
      { code: "learned", percent: 100 },
      { code: "fun", percent: 60 },
      { code: "interesting", percent: 60 },
    ]);
  });

  it("should never show a negative appreciation, however ticked", () => {
    const trend = publicTrend([...votes(5, ["tooComplex", "notClear"]), ...votes(1, ["learned"])]);
    expect(trend).toEqual([{ code: "learned", percent: 17 }]);
  });
});

describe("test mode (#566)", () => {
  const TEST = { ...EDITION, feedbackTestMode: true };

  it("should open voting before the event day", () => {
    expect(feedbackPhase(TEST, new Date("2026-10-07T10:00:00.000Z"))).toBe("open");
  });

  it("should mark a vote cast before the event day as a test", () => {
    expect(isTestVote(TEST, new Date("2026-11-18T22:59:00.000Z"))).toBe(true);
  });

  it("should make a vote real from the event day, even with the test mode left on", () => {
    expect(isTestVote(TEST, new Date("2026-11-18T23:00:00.000Z"))).toBe(false);
  });

  it("should not reopen voting once it is over", () => {
    expect(feedbackPhase(TEST, new Date("2026-11-21T10:00:00.000Z"))).toBe("closed");
  });
});
