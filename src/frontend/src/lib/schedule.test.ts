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
    simulcasts: [],
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
    expect(slot.cells[0].map((c) => c.talk.slug)).toEqual(["a"]);
    expect(slot.cells[1].map((c) => c.talk.slug)).toEqual(["b"]);
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
    expect(slot.cells[0].map((c) => c.talk.slug)).toEqual(["old"]);
  });
});

describe("relayed talks (#456)", () => {
  it("draws the keynote in the room it is given in and in every relay room", () => {
    const rows = buildScheduleRows(
      schedule({
        talks: [
          talk({
            slug: "keynote",
            format: "KEYNOTE",
            simulcasts: [{ roomId: HEMI.id, room: HEMI.name }],
          }),
        ],
      }),
    );

    const slot = rows[0];
    if (slot.type !== "slot") throw new Error("expected a slot row");
    expect(slot.cells[0].map((c) => c.talk.slug)).toEqual(["keynote"]);
    expect(slot.cells[1].map((c) => c.talk.slug)).toEqual(["keynote"]);
  });

  it("marks the relay, so the grid can say it is a screen and not the speaker", () => {
    const rows = buildScheduleRows(
      schedule({
        talks: [
          talk({ slug: "keynote", simulcasts: [{ roomId: HEMI.id, room: HEMI.name }] }),
        ],
      }),
    );

    const slot = rows[0];
    if (slot.type !== "slot") throw new Error("expected a slot row");
    expect(slot.cells[0][0].isSimulcast).toBe(false);
    expect(slot.cells[1][0].isSimulcast).toBe(true);
  });

  it("reads the relay by its frozen label when the room is gone (#375)", () => {
    // The room was deleted, so only the name printed that year survives — the
    // endpoint builds the column the same way, from the same frozen label.
    const rows = buildScheduleRows(
      schedule({
        rooms: [AMPHI, { id: null, name: "Agora 1", sortOrder: 9 }],
        talks: [talk({ slug: "keynote", simulcasts: [{ roomId: null, room: "Agora 1" }] })],
      }),
    );

    const slot = rows[0];
    if (slot.type !== "slot") throw new Error("expected a slot row");
    expect(slot.cells[1].map((c) => c.talk.slug)).toEqual(["keynote"]);
  });

  it("drops a relay the grid has no column for rather than parking it in the first", () => {
    // Unlike the room a talk is given in, a relay with nowhere to go is not
    // worth inventing a position for — it would land on top of another room.
    const rows = buildScheduleRows(
      schedule({
        talks: [talk({ slug: "keynote", simulcasts: [{ roomId: 99, room: "Salle inconnue" }] })],
      }),
    );

    const slot = rows[0];
    if (slot.type !== "slot") throw new Error("expected a slot row");
    expect(slot.cells[0].map((c) => c.talk.slug)).toEqual(["keynote"]);
    expect(slot.cells[1]).toEqual([]);
  });
});

// Two 20-minute quickies fill the 40 minutes of one conference (#462). The
// second opens a row halfway through, and everything still running has to
// reach across it — or the grid draws those rooms as free, and since #455 as
// "nothing scheduled", which is worse than blank.

function slotRow(rows: ReturnType<typeof buildScheduleRows>, index: number) {
  const row = rows[index];
  if (row.type !== "slot") throw new Error(`row ${index} is not a slot row`);
  return row;
}

const QUICKIE_PAIR = {
  talks: [
    talk({ slug: "conf", startsAt: "2026-11-19T08:00:00.000Z", endsAt: "2026-11-19T08:40:00.000Z" }),
    talk({
      slug: "quickie-a",
      room: HEMI.name,
      roomId: HEMI.id,
      startsAt: "2026-11-19T08:00:00.000Z",
      endsAt: "2026-11-19T08:20:00.000Z",
    }),
    talk({
      slug: "quickie-b",
      room: HEMI.name,
      roomId: HEMI.id,
      startsAt: "2026-11-19T08:20:00.000Z",
      endsAt: "2026-11-19T08:40:00.000Z",
    }),
  ],
};

describe("a session that outlasts its own row", () => {
  it("is rendered once, reaching across the rows it covers", () => {
    const rows = buildScheduleRows(schedule(QUICKIE_PAIR));

    expect(rows).toHaveLength(2);
    expect(slotRow(rows, 0).cells[0].map((c) => c.talk.slug)).toEqual(["conf"]);
    expect(slotRow(rows, 0).cells[0][0].rowSpan).toBe(2);
    // Once, not twice: a session repeated would be two favourites, two
    // calendar entries, and the same title read aloud twice.
    expect(slotRow(rows, 1).cells[0]).toEqual([]);
  });

  it("marks the rooms it still occupies, so they are not drawn as free", () => {
    const rows = buildScheduleRows(schedule(QUICKIE_PAIR));

    expect(slotRow(rows, 1).covered[0]).toBe(true);
    expect(slotRow(rows, 1).cells[1].map((c) => c.talk.slug)).toEqual(["quickie-b"]);
    expect(slotRow(rows, 1).covered[1]).toBe(false);
  });

  it("leaves a genuinely free room free", () => {
    // A third room with nothing in it must still read as empty on the second
    // row — "occupied" and "free" have to stay distinguishable, or the dash of
    // #455 loses its meaning in both directions.
    const rows = buildScheduleRows({
      ...schedule(QUICKIE_PAIR),
      rooms: [AMPHI, HEMI, { id: 3, name: "Pastel", sortOrder: 2 }],
    });

    expect(slotRow(rows, 1).covered[2]).toBe(false);
    expect(slotRow(rows, 1).cells[2]).toEqual([]);
  });

  it("does not split a row when the quickie has no partner", () => {
    const rows = buildScheduleRows(
      schedule({
        talks: [
          talk({ slug: "conf" }),
          talk({
            slug: "quickie-seul",
            room: HEMI.name,
            roomId: HEMI.id,
            endsAt: "2026-11-19T08:20:00.000Z",
          }),
        ],
      }),
    );

    // No second start time, so no second row — the case degrades on its own.
    expect(rows).toHaveLength(1);
    expect(slotRow(rows, 0).cells[0][0].rowSpan).toBe(1);
  });

  it("carries a relay across the same rows as the session it mirrors", () => {
    const rows = buildScheduleRows(
      schedule({
        talks: [
          talk({ slug: "keynote", simulcasts: [{ roomId: HEMI.id, room: HEMI.name }] }),
          talk({
            slug: "quickie-b",
            room: HEMI.name,
            roomId: HEMI.id,
            startsAt: "2026-11-19T08:20:00.000Z",
            endsAt: "2026-11-19T08:40:00.000Z",
          }),
        ],
      }),
    );

    // The relay is the same session; it occupies its room for just as long.
    expect(slotRow(rows, 0).cells[1][0].rowSpan).toBe(2);
    expect(slotRow(rows, 1).covered[1]).toBe(true);
  });

  it("stops at a band rather than pushing it sideways", () => {
    // A band is a full-width row: no cell can span across one. Nothing in the
    // 2026 day does — the breaks fall between slots — but a schedule that did
    // would otherwise render a broken table instead of an imperfect one.
    const rows = buildScheduleRows(
      schedule({
        ...QUICKIE_PAIR,
        entries: [
          {
            id: 1,
            kind: "BREAK",
            labelFr: "Pause",
            labelEn: "Break",
            startsAt: "2026-11-19T08:10:00.000Z",
            endsAt: "2026-11-19T08:15:00.000Z",
            room: null,
          },
        ] as unknown as EditionSchedule["entries"],
      }),
    );

    expect(rows[1].type).toBe("band");
    expect(slotRow(rows, 0).cells[0][0].rowSpan).toBe(1);
  });
});
