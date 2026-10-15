import { describe, it, expect } from "vitest";

import { talkPath } from "./talk-path";

// #633 — one page per talk of the featured edition, dated pages for the others.
describe("talkPath (#633)", () => {
  it("should send a talk of the featured edition to /conferences", () => {
    expect(talkPath("ia", 2026, 2026)).toBe("/conferences/ia");
  });

  it("should keep the dated page of a past year, or when no edition is featured", () => {
    expect(talkPath("ia", 2019, 2026)).toBe("/editions/2019/conferences/ia");
    expect(talkPath("ia", 2026, null)).toBe("/editions/2026/conferences/ia");
  });
});
