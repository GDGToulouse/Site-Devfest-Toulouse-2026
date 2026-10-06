import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { importSessionize } from "../lib/sessionize-import.js";

// The import places sessions in the grid (#519): Sessionize times are Paris
// wall-clock times, and Sessionize rooms are paired once with the venue's rooms.

// A past year, for the reason given in sessionize-import-mapping.test.ts (#292).
const TEST_YEAR = 1998;
const VENUE = "Centre de test #519";

const SZ_AMPHI = 80944;
const SZ_PASTEL = 80945;
const SZ_COCAGNE = 90938;

function payload(overrides: { amphiStart?: string } = {}) {
  return {
    speakers: [],
    categories: [],
    rooms: [
      { id: SZ_AMPHI, name: "Amphi", sort: 0 },
      { id: SZ_PASTEL, name: "Pastel", sort: 1 },
      { id: SZ_COCAGNE, name: "Cocagne", sort: 2 },
    ],
    sessions: [
      {
        id: "a",
        title: "Ouverture 1998",
        startsAt: overrides.amphiStart ?? "1998-11-19T09:00:00",
        endsAt: "1998-11-19T09:40:00",
        roomId: SZ_AMPHI,
      },
      { id: "b", title: "Talk Pastel 1998", startsAt: "1998-11-19T10:00:00", endsAt: "1998-11-19T10:45:00", roomId: SZ_PASTEL },
      { id: "c", title: "Talk Cocagne 1998", startsAt: "1998-11-19T10:00:00", endsAt: "1998-11-19T10:45:00", roomId: SZ_COCAGNE },
    ],
  };
}

let editionId: number;
let amphiId: number;
let pastelId: number;

async function talk(title: string) {
  return prisma.talk.findFirstOrThrow({ where: { editionId, title } });
}

describe("importSessionize schedule (#519)", () => {
  beforeAll(async () => {
    const venue = await prisma.venue.create({
      data: {
        name: VENUE,
        rooms: { create: [{ name: "Amphithéâtre", sortOrder: 0 }, { name: "Pastel", sortOrder: 1 }] },
      },
      include: { rooms: true },
    });
    amphiId = venue.rooms.find((room) => room.name === "Amphithéâtre")!.id;
    pastelId = venue.rooms.find((room) => room.name === "Pastel")!.id;
    const edition = await prisma.edition.create({ data: { year: TEST_YEAR, venueId: venue.id } });
    editionId = edition.id;
  });

  afterAll(async () => {
    await prisma.talk.deleteMany({ where: { editionId } });
    await prisma.edition.delete({ where: { id: editionId } });
    await prisma.venue.delete({ where: { name: VENUE } });
  });

  it("should place sessions at Paris time, pair same-name rooms and report the others", async () => {
    const report = await importSessionize(editionId, payload());

    const pastel = await talk("Talk Pastel 1998");
    expect(pastel.startsAt?.toISOString()).toBe("1998-11-19T09:00:00.000Z");
    expect(pastel.endsAt?.toISOString()).toBe("1998-11-19T09:45:00.000Z");
    expect(pastel.roomId).toBe(pastelId);
    expect(pastel.roomLabel).toBe("Pastel");

    // "Amphi" is not "Amphithéâtre": slot kept, no room, and the report says so.
    const opening = await talk("Ouverture 1998");
    expect(opening.startsAt?.toISOString()).toBe("1998-11-19T08:00:00.000Z");
    expect(opening.roomId).toBeNull();
    expect(report.unmappedRooms).toEqual([
      { sessionizeId: SZ_AMPHI, name: "Amphi", sessions: 1 },
      { sessionizeId: SZ_COCAGNE, name: "Cocagne", sessions: 1 },
    ]);
  });

  it("should reuse a pairing on the next import and rewrite a slot moved in Sessionize", async () => {
    await prisma.sessionizeRoom.update({
      where: { editionId_sessionizeId: { editionId, sessionizeId: SZ_AMPHI } },
      data: { roomId: amphiId },
    });

    const report = await importSessionize(editionId, payload({ amphiStart: "1998-11-19T09:05:00" }));

    const opening = await talk("Ouverture 1998");
    expect(opening.roomId).toBe(amphiId);
    expect(opening.roomLabel).toBe("Amphithéâtre");
    expect(opening.startsAt?.toISOString()).toBe("1998-11-19T08:05:00.000Z");
    expect(report.unmappedRooms.map((room) => room.name)).toEqual(["Cocagne"]);
  });

  it("should warn when two sessions overlap in one room", async () => {
    const clashing = payload();
    clashing.sessions[1].roomId = SZ_AMPHI;
    clashing.sessions[1].startsAt = "1998-11-19T09:30:00";

    const report = await importSessionize(editionId, clashing);

    expect(report.warnings.some((warning) => warning.includes("Amphithéâtre") && warning.includes("chevauchent"))).toBe(true);
  });
});
