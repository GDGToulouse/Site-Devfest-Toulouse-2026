import { describe, it, expect } from "vitest";
import {
  feedbackPhase,
  feedbackWindow,
  isTestVote,
  publicResults,
  sessionFeedbackOpensAt,
  sessionFeedbackPhase,
} from "./talk-feedback.js";

// #564 — votes open the day of the event and the next, on Paris clocks. #803 —
// the public sees every appreciation's count, from the first vote.

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

describe("publicResults (#803)", () => {
  it("should count a single vote", () => {
    expect(publicResults([{ items: ["learned"] }])).toMatchObject({
      votes: 1,
      items: expect.arrayContaining([{ code: "learned", count: 1 }]),
    });
  });

  it("should count every appreciation, negatives included, in the fixed order", () => {
    const results = publicResults([{ items: ["learned", "tooComplex"] }, { items: ["tooComplex"] }]);

    expect(results).toEqual({
      votes: 2,
      items: [
        { code: "fun", count: 0 },
        { code: "learned", count: 1 },
        { code: "interesting", count: 0 },
        { code: "speaker", count: 0 },
        { code: "notClear", count: 0 },
        { code: "tooTechnical", count: 0 },
        { code: "lackOfDemo", count: 0 },
        { code: "tooComplex", count: 2 },
      ],
    });
  });

  it("should give zero votes when nobody has voted", () => {
    expect(publicResults([]).votes).toBe(0);
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

describe("sessionFeedbackPhase (#809)", () => {
  // 10:00-10:45 in Paris on the event day.
  const SESSION = { startsAt: new Date("2026-11-19T09:00:00.000Z"), endsAt: new Date("2026-11-19T09:45:00.000Z") };

  it("should open ten minutes before the session ends", () => {
    expect(sessionFeedbackOpensAt(SESSION)).toEqual(new Date("2026-11-19T09:35:00.000Z"));
  });

  it("should open at its start a session without an end", () => {
    expect(sessionFeedbackOpensAt({ ...SESSION, endsAt: null })).toEqual(SESSION.startsAt);
  });

  it("should stay upcoming on the day until then", () => {
    expect(sessionFeedbackPhase(EDITION, SESSION, new Date("2026-11-19T09:34:00.000Z"))).toBe("upcoming");
  });

  it("should be open from then", () => {
    expect(sessionFeedbackPhase(EDITION, SESSION, new Date("2026-11-19T09:35:00.000Z"))).toBe("open");
  });

  it("should close with the edition's window", () => {
    expect(sessionFeedbackPhase(EDITION, SESSION, new Date("2026-11-20T23:00:00.000Z"))).toBe("closed");
  });

  it("should never open a session without any time", () => {
    expect(sessionFeedbackPhase(EDITION, { startsAt: null, endsAt: null }, new Date("2026-11-19T20:00:00.000Z"))).toBe("upcoming");
  });

  it("should open every session in the test mode, before the event", () => {
    expect(sessionFeedbackPhase({ ...EDITION, feedbackTestMode: true }, SESSION, new Date("2026-10-07T10:00:00.000Z"))).toBe("open");
  });

  it("should apply the ten minutes on the day, even with the test mode left on", () => {
    expect(sessionFeedbackPhase({ ...EDITION, feedbackTestMode: true }, SESSION, new Date("2026-11-19T09:00:00.000Z"))).toBe("upcoming");
  });
});
