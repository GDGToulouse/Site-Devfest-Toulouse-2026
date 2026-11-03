import { describe, it, expect } from "vitest";

import {
  DEFAULT_FIELDS,
  buildRoomSections,
  buildTimeSections,
  formatFieldsParam,
  parseFields,
  parseGrouping,
  parseRoom,
  sectionToText,
  type TextLabels,
} from "./programme-text";
import type { EditionSchedule } from "./types";

// The plain view of the programme (#755): what a designer copies into a
// kakemono, what a camera operator prints with room for notes.

const schedule: EditionSchedule = {
  year: 2026,
  rooms: [
    { id: 1, name: "Amphi", sortOrder: 0 },
    { id: 2, name: "Agora", sortOrder: 1 },
  ],
  talks: [
    {
      slug: "late",
      title: "Talk de l'après-midi",
      format: "CONFERENCE",
      level: "CONFIRME",
      language: "fr",
      category: { nameFr: "Cloud", nameEn: "Cloud", color: "#000" },
      speakers: [{ slug: "a", name: "Ada Lovelace", photoUrl: null }],
      room: "Amphi",
      roomId: 1,
      simulcasts: [],
      startsAt: "2026-11-20T13:00:00.000Z",
      endsAt: "2026-11-20T13:45:00.000Z",
    },
    {
      slug: "parallel",
      title: "En parallèle",
      format: "QUICKIE",
      level: null,
      language: "fr",
      category: null,
      speakers: [],
      room: "Agora",
      roomId: 2,
      simulcasts: [],
      startsAt: "2026-11-20T13:00:00.000Z",
      endsAt: "2026-11-20T13:20:00.000Z",
    },
    {
      slug: "keynote",
      title: "Keynote d'ouverture",
      format: "KEYNOTE",
      level: "DEBUTANT",
      language: "en",
      category: null,
      speakers: [
        { slug: "b", name: "Grace Hopper", photoUrl: null },
        { slug: "c", name: "Alan Turing", photoUrl: null },
      ],
      room: "Amphi",
      roomId: 1,
      simulcasts: [{ roomId: 2, room: "Agora" }],
      startsAt: "2026-11-20T08:00:00.000Z",
      endsAt: "2026-11-20T08:45:00.000Z",
    },
  ],
  entries: [
    {
      id: 7,
      kind: "MEAL",
      labelFr: "Déjeuner",
      labelEn: "Lunch",
      startsAt: "2026-11-20T11:00:00.000Z",
      endsAt: "2026-11-20T12:00:00.000Z",
      roomId: null,
      room: null,
    },
  ],
} as EditionSchedule;

const labels: TextLabels = {
  formatLabels: { CONFERENCE: "Conférence", KEYNOTE: "Keynote", QUICKIE: "Quickie" },
  levelLabels: { DEBUTANT: "Débutant", CONFIRME: "Confirmé" },
  languageLabels: { fr: "Français", en: "Anglais" },
  simulcast: "Retransmission",
  roomTba: "Salle à préciser",
};

describe("programme text view (#755)", () => {
  it("shows the times by default, on top of the title and speakers", () => {
    expect(DEFAULT_FIELDS).toEqual(["time"]);
    expect(parseFields(null)).toEqual(["time"]);
  });

  it("lets the times go: an empty choice is kept, not replaced by the default", () => {
    expect(parseFields("")).toEqual([]);
  });

  it("keeps the known fields of the URL, in a fixed order, and drops the rest", () => {
    expect(parseFields("notes,time,bogus,level,time")).toEqual(["time", "level", "notes"]);
  });

  it("leaves the default out of the address, and writes any other choice, even none", () => {
    expect(formatFieldsParam(["time"])).toBeNull();
    expect(formatFieldsParam(["notes", "time"])).toBe("time,notes");
    expect(formatFieldsParam([])).toBe("");
  });

  it("groups by room unless asked to group by time", () => {
    expect(parseGrouping(null)).toBe("room");
    expect(parseGrouping("bogus")).toBe("room");
    expect(parseGrouping("time")).toBe("time");
  });

  it("reads a room from the URL, or none", () => {
    expect(parseRoom("2")).toBe(2);
    expect(parseRoom(null)).toBeNull();
    expect(parseRoom("abc")).toBeNull();
    expect(parseRoom("1.5")).toBeNull();
  });

  it("lists each room's sessions in time order, relays included", () => {
    const { rooms, bands } = buildRoomSections(schedule);

    expect(rooms.map((r) => [r.room.name, r.items.map((i) => i.talk.slug)])).toEqual([
      ["Amphi", ["keynote", "late"]],
      ["Agora", ["keynote", "parallel"]],
    ]);
    expect(rooms[1].items[0].isSimulcast).toBe(true);
    expect(bands.map((b) => b.labelFr)).toEqual(["Déjeuner"]);
  });

  it("lists the day by start time, each session once with its room, the shared moments in place", () => {
    const slots = buildTimeSections(schedule);

    expect(
      slots.map((s) =>
        s.type === "band" ? ["band", s.entry.labelFr] : [s.startsAt, s.items.map((i) => `${i.talk.slug}@${i.roomName}`)],
      ),
    ).toEqual([
      ["2026-11-20T08:00:00.000Z", ["keynote@Amphi"]],
      ["band", "Déjeuner"],
      ["2026-11-20T13:00:00.000Z", ["late@Amphi", "parallel@Agora"]],
    ]);
  });

  it("copies a room as one plain line per session: time, title, speakers", () => {
    const { rooms } = buildRoomSections(schedule);

    expect(sectionToText(rooms[0].items, ["time"], "fr", labels)).toBe(
      "09:00 – 09:45\tKeynote d'ouverture\tGrace Hopper, Alan Turing\n14:00 – 14:45\tTalk de l'après-midi\tAda Lovelace",
    );
  });

  it("adds the room to a line copied from the time view", () => {
    const slots = buildTimeSections(schedule);
    const afternoon = slots[2];
    if (afternoon.type !== "slot") throw new Error("expected a slot");

    expect(sectionToText(afternoon.items, [], "fr", labels)).toBe(
      "Talk de l'après-midi\tAda Lovelace\tAmphi\nEn parallèle\t\tAgora",
    );
  });

  it("adds the chosen fields to the copied text, never the notes", () => {
    const { rooms } = buildRoomSections(schedule);

    expect(
      sectionToText(rooms[1].items.slice(0, 1), ["time", "format", "category", "language", "level", "notes"], "fr", labels),
    ).toBe("09:00 – 09:45\tKeynote d'ouverture\tGrace Hopper, Alan Turing\tKeynote\t\tAnglais\tDébutant\tRetransmission");
  });
});
