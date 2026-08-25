import { describe, it, expect } from "vitest";

import { buildCalendar, escapeText, foldLine } from "./ics.js";

// The rules that decide whether a client accepts the file at all (#443). None
// of them shows up in a rendered page, and all of them break an import.

const STAMP = new Date("2026-08-21T10:00:00.000Z");

function event(over: Partial<Parameters<typeof buildCalendar>[0][number]> = {}) {
  return {
    uid: "kubernetes-en-production-2026@devfesttoulouse.fr",
    start: new Date("2026-11-19T10:55:00.000Z"),
    end: new Date("2026-11-19T11:35:00.000Z"),
    summary: "Kubernetes en production",
    sequence: 1,
    ...over,
  };
}

describe("iCalendar escaping", () => {
  it("escapes the characters that separate values in the format", () => {
    // Without this, "Kubernetes, Istio et le reste" splits into two values and
    // the summary is truncated at the comma.
    expect(escapeText("Kubernetes, Istio; et le reste")).toBe(
      "Kubernetes\\, Istio\\; et le reste",
    );
  });

  it("escapes the backslash before anything else", () => {
    expect(escapeText("a\\b,c")).toBe("a\\\\b\\,c");
  });

  it("turns a line break into its escape rather than ending the property", () => {
    expect(escapeText("Marie Dupont\nJean Martin")).toBe("Marie Dupont\\nJean Martin");
  });
});

describe("line folding", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:court")).toBe("SUMMARY:court");
  });

  it("folds past 75 octets, continuing with a space", () => {
    const long = `SUMMARY:${"a".repeat(120)}`;
    const folded = foldLine(long);
    expect(folded).toContain("\r\n ");
    for (const line of folded.split("\r\n")) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
    }
  });

  it("counts octets, not characters, and never cuts an accent in half", () => {
    // 74 accented characters are 148 bytes: a character-based fold would emit
    // one line and overflow, a naive byte cut would split "é" down the middle.
    const long = `LOCATION:${"é".repeat(74)}`;
    const folded = foldLine(long);
    expect(folded.split("\r\n").length).toBeGreaterThan(1);
    // Reassembling drops the fold and its leading space: nothing is lost.
    expect(folded.split("\r\n ").join("")).toBe(long);
  });
});

describe("the calendar file", () => {
  it("wraps the events and ends every line with CRLF", () => {
    const ics = buildCalendar([event()], { calendarName: "DevFest Toulouse 2026", stamp: STAMP });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("writes times as UTC instants", () => {
    // The one place UTC is the right answer: the reader's calendar converts it
    // to wherever they are. The page does the opposite (#106).
    const ics = buildCalendar([event()], { calendarName: "x", stamp: STAMP });
    expect(ics).toContain("DTSTART:20261119T105500Z");
    expect(ics).toContain("DTEND:20261119T113500Z");
  });

  it("keeps the UID stable so a re-import updates instead of duplicating", () => {
    const first = buildCalendar([event()], { calendarName: "x", stamp: STAMP });
    const later = buildCalendar([event({ summary: "Titre corrigé", sequence: 2 })], {
      calendarName: "x",
      stamp: new Date("2026-09-01T10:00:00.000Z"),
    });

    const uid = "UID:kubernetes-en-production-2026@devfesttoulouse.fr";
    expect(first).toContain(uid);
    expect(later).toContain(uid);
    expect(later).toContain("SEQUENCE:2");
  });

  it("omits DTEND rather than inventing a duration", () => {
    const ics = buildCalendar([event({ end: null })], { calendarName: "x", stamp: STAMP });
    expect(ics).toContain("DTSTART:");
    expect(ics).not.toContain("DTEND:");
  });

  it("leaves the URL unescaped — it is not a text value", () => {
    const url = "https://devfesttoulouse.fr/fr/conferences/kubernetes-en-production";
    const ics = buildCalendar([event({ url })], { calendarName: "x", stamp: STAMP });
    expect(ics).toContain(`URL:${url}`);
  });
});
