import { describe, it, expect } from "vitest";

import { buildScheduleXml, escapeXml, stableUuid, type ScheduleTalk } from "./schedule-xml.js";

// The schedule.xml grammar (#827). What reaches the file from the database is
// covered in __tests__/calendar-schedule-xml.test.ts.

const conference = { year: 2026, baseUrl: "https://devfesttoulouse.fr", generatorVersion: "1.15.0", version: "v1" };

function talk(overrides: Partial<ScheduleTalk> = {}): ScheduleTalk {
  return {
    id: 7,
    slug: "kubernetes-en-production",
    title: "Kubernetes en production",
    description: "Retour d'expérience",
    format: "CONFERENCE",
    language: "fr",
    // 09:50 in Toulouse, on winter time.
    start: new Date("2026-11-19T08:50:00.000Z"),
    end: new Date("2026-11-19T09:30:00.000Z"),
    room: "Amphithéâtre",
    roomOrder: 0,
    track: "Cloud & DevOps",
    speakers: [{ id: 3, name: "Ada Lovelace" }],
    url: "https://devfesttoulouse.fr/fr/conferences/kubernetes-en-production",
    ...overrides,
  };
}

describe("buildScheduleXml (#827)", () => {
  it("should give the time as Toulouse reads it, with the day's offset", () => {
    const xml = buildScheduleXml(conference, [talk()]);

    expect(xml).toContain("<date>2026-11-19T09:50:00+01:00</date>");
    expect(xml).toContain("<start>09:50</start>");
    expect(xml).toContain("<duration>00:40</duration>");
  });

  it("should count a duration past the hour in hours and minutes", () => {
    const xml = buildScheduleXml(conference, [talk({ format: "WORKSHOP", end: new Date("2026-11-19T10:50:00.000Z") })]);

    expect(xml).toContain("<duration>02:00</duration>");
    expect(xml).toContain("<type>Workshop</type>");
  });

  it("should file a late session under the Toulouse day, not the UTC one", () => {
    const xml = buildScheduleXml(conference, [
      talk(),
      talk({ id: 8, slug: "after", title: "After", start: new Date("2026-11-19T23:30:00.000Z"), end: null }),
    ]);

    expect(xml).toContain('<day index="1" date="2026-11-19"');
    expect(xml).toContain('<day index="2" date="2026-11-20"');
    expect(xml).toContain("<days>2</days>");
  });

  it("should put each room once a day, in the grid's order", () => {
    const xml = buildScheduleXml(conference, [
      talk({ id: 1, slug: "pastel-un", room: "Pastel", roomOrder: 3 }),
      talk({ id: 2, slug: "amphi-un", room: "Amphithéâtre", roomOrder: 0 }),
      talk({ id: 3, slug: "pastel-deux", room: "Pastel", roomOrder: 3, start: new Date("2026-11-19T13:00:00.000Z") }),
    ]);

    expect(xml.match(/<room name="Pastel"/g)).toHaveLength(1);
    expect(xml.indexOf('<room name="Amphithéâtre"')).toBeLessThan(xml.indexOf('<room name="Pastel"'));
  });

  it("should escape what XML would read as markup", () => {
    const xml = buildScheduleXml(conference, [talk({ title: 'Tests & "mocks" <enfin>' })]);

    expect(xml).toContain("<title>Tests &amp; &quot;mocks&quot; &lt;enfin&gt;</title>");
  });

  it("should list the speakers and link the session page", () => {
    const xml = buildScheduleXml(conference, [talk()]);

    expect(xml).toContain('<person id="3">Ada Lovelace</person>');
    expect(xml).toContain("<url>https://devfesttoulouse.fr/fr/conferences/kubernetes-en-production</url>");
  });
});

describe("stableUuid", () => {
  it("should give the same UUID for the same key, and a valid v5 shape", () => {
    expect(stableUuid("2026/talk/7")).toBe(stableUuid("2026/talk/7"));
    expect(stableUuid("2026/talk/7")).not.toBe(stableUuid("2026/talk/8"));
    expect(stableUuid("2026/talk/7")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("escapeXml", () => {
  it("should drop the control characters XML 1.0 refuses", () => {
    expect(escapeXml("a\u0001b\tc")).toBe("ab\tc");
  });
});
