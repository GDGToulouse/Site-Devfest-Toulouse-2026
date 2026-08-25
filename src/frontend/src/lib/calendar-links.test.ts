import { describe, it, expect } from "vitest";

import { googleCalendarUrl, outlookCalendarUrl, icsUrl } from "./calendar-links";

const session = {
  slug: "kubernetes-en-production",
  title: "Kubernetes, en production",
  startsAt: "2026-11-19T10:55:00.000Z",
  endsAt: "2026-11-19T11:35:00.000Z",
  room: "Amphithéâtre",
  speakers: ["Marie Dupont"],
  year: 2026,
  url: "https://devfesttoulouse.fr/fr/conferences/kubernetes-en-production",
  venue: "Diagora, Labège",
};

describe("calendar composition links (#443)", () => {
  it("hands Google the instant, in UTC", () => {
    // The suite runs on Europe/Paris: a local formatting would send 11:55 and
    // put the session an hour late on the reader's calendar.
    const url = new URL(googleCalendarUrl(session));
    expect(url.searchParams.get("dates")).toBe("20261119T105500Z/20261119T113500Z");
  });

  it("escapes the title rather than truncating it at the comma", () => {
    const url = new URL(googleCalendarUrl(session));
    expect(url.searchParams.get("text")).toBe("Kubernetes, en production");
  });

  it("carries the room and the venue as the location", () => {
    const url = new URL(googleCalendarUrl(session));
    expect(url.searchParams.get("location")).toBe("Amphithéâtre — Diagora, Labège");
  });

  it("gives Outlook ISO instants", () => {
    const url = new URL(outlookCalendarUrl(session));
    expect(url.searchParams.get("startdt")).toBe("2026-11-19T10:55:00.000Z");
    expect(url.searchParams.get("enddt")).toBe("2026-11-19T11:35:00.000Z");
  });

  it("falls back to a conference-length slot when the end is missing", () => {
    // Both composition URLs require an end; ours does not, and omits it.
    const url = new URL(googleCalendarUrl({ ...session, endsAt: null }));
    expect(url.searchParams.get("dates")).toBe("20261119T105500Z/20261119T113500Z");
  });

  it("points the file at the year-scoped route, filtered to one session", () => {
    expect(icsUrl(session)).toBe(
      "/api/editions/2026/schedule.ics?talks=kubernetes-en-production",
    );
  });
});
