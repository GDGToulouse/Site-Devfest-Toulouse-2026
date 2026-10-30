import { describe, it, expect } from "vitest";

import {
  buildRoomSections,
  formatFieldsParam,
  parseFields,
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
  formatLabels: { CONFERENCE: "Conférence", KEYNOTE: "Keynote" },
  levelLabels: { DEBUTANT: "Débutant", CONFIRME: "Confirmé" },
  languageLabels: { fr: "Français", en: "Anglais" },
  simulcast: "Retransmission",
};

describe("programme text view (#755)", () => {
  it("shows the title and the speakers only, unless asked for more", () => {
    expect(parseFields(null)).toEqual([]);
    expect(parseFields("")).toEqual([]);
  });

  it("keeps the known fields of the URL, in a fixed order, and drops the rest", () => {
    expect(parseFields("notes,time,bogus,level,time")).toEqual(["time", "level", "notes"]);
    expect(formatFieldsParam(["notes", "time"])).toBe("time,notes");
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
      ["Agora", ["keynote"]],
    ]);
    expect(rooms[1].items[0].isSimulcast).toBe(true);
    expect(bands.map((b) => b.labelFr)).toEqual(["Déjeuner"]);
  });

  it("copies a room as one plain line per session: title then speakers", () => {
    const { rooms } = buildRoomSections(schedule);

    expect(sectionToText(rooms[0], [], "fr", labels)).toBe(
      "Keynote d'ouverture\tGrace Hopper, Alan Turing\nTalk de l'après-midi\tAda Lovelace",
    );
  });

  it("adds the chosen fields to the copied text, never the notes", () => {
    const { rooms } = buildRoomSections(schedule);

    expect(sectionToText(rooms[1], ["time", "format", "category", "language", "level", "notes"], "fr", labels)).toBe(
      "09:00 – 09:45\tKeynote d'ouverture\tGrace Hopper, Alan Turing\tKeynote\t\tAnglais\tDébutant\tRetransmission",
    );
  });
});
