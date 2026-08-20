import { describe, it, expect } from "vitest";

import { buildScheduleRows } from "./schedule";
import type { EditionSchedule } from "./types";

const AMPHI = { id: 1, name: "Amphithéâtre", sortOrder: 0 };
const HEMI = { id: 2, name: "Hémicycle", sortOrder: 1 };

function talk(over: Partial<EditionSchedule["talks"][number]>): EditionSchedule["talks"][number] {
  return {
    slug: "t",
    title: "Talk",
    format: "CONFERENCE",
    level: null,
    language: "fr",
    category: null,
    speakers: [],
    room: AMPHI.name,
    roomId: AMPHI.id,
    startsAt: "2026-11-19T08:00:00.000Z",
    endsAt: "2026-11-19T08:40:00.000Z",
    ...over,
  };
}

function schedule(over: Partial<EditionSchedule> = {}): EditionSchedule {
  return { year: 2026, rooms: [AMPHI, HEMI], talks: [], entries: [], ...over };
}

describe("buildScheduleRows", () => {
  it("puts each talk in its room's column", () => {
    const rows = buildScheduleRows(
      schedule({
        talks: [
          talk({ slug: "a" }),
          talk({ slug: "b", room: HEMI.name, roomId: HEMI.id }),
        ],
      }),
    );

    expect(rows).toHaveLength(1);
    const slot = rows[0];
    if (slot.type !== "slot") throw new Error("expected a slot row");
    expect(slot.cells[0].map((t) => t.slug)).toEqual(["a"]);
    expect(slot.cells[1].map((t) => t.slug)).toEqual(["b"]);
  });

  it("groups talks that start at the same moment into one row", () => {
    const rows = buildScheduleRows(
      schedule({
        talks: [
          talk({ slug: "a" }),
          talk({ slug: "b", room: HEMI.name, roomId: HEMI.id }),
          talk({ slug: "c", startsAt: "2026-11-19T09:00:00.000Z" }),
        ],
      }),
    );

    expect(rows.map((r) => r.startsAt)).toEqual([
      "2026-11-19T08:00:00.000Z",
      "2026-11-19T09:00:00.000Z",
    ]);
  });

  it("does not let a break hide the sessions running under it", () => {
    // The 2025 case: lunch spans 12:45–14:15 and quickies play inside it. The
    // band is a row like any other — it never swallows the slot.
    const rows = buildScheduleRows(
      schedule({
        talks: [talk({ slug: "quickie", startsAt: "2026-11-19T12:55:00.000Z" })],
        entries: [
          {
            id: 7,
            kind: "MEAL",
            labelFr: "Déjeuner",
            labelEn: "Lunch",
            startsAt: "2026-11-19T12:45:00.000Z",
            endsAt: "2026-11-19T14:15:00.000Z",
            roomId: null,
            room: null,
          },
        ],
      }),
    );

    expect(rows.map((r) => r.type)).toEqual(["band", "slot"]);
  });

  it("keeps a talk whose room no longer exists, on its frozen label", () => {
    // A room deleted after the grid was published (#375): the column carries no
    // id, only the label the signage had that year.
    const ghost = { id: null, name: "Salle Pastel", sortOrder: 0 };
    const rows = buildScheduleRows(
      schedule({
        rooms: [ghost],
        talks: [talk({ slug: "old", roomId: null, room: "Salle Pastel" })],
      }),
    );

    const slot = rows[0];
    if (slot.type !== "slot") throw new Error("expected a slot row");
    expect(slot.cells[0].map((t) => t.slug)).toEqual(["old"]);
  });
});
