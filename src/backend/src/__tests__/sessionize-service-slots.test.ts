import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { importSessionize } from "../lib/sessionize-import.js";
import { extractServiceSlots, gridSmartUrl, slotKind, englishLabel } from "../lib/sessionize-service-slots.js";

// #546 — the import brings in Sessionize's service sessions (welcome, breaks,
// lunch, keynotes still without a speaker, the after) as schedule entries, and
// keeps them in line on every re-import without touching what was typed by hand.

// A year no other test file uses (#292), recent enough for Paris to be on CET:
// a 17th-century date would get the local mean time offset.
const YEAR = 1975;
const VENUE = "Centre de test #546";
const SZ_AMPHI = 80944;
const SZ_AGORA2 = 80951;
const SZ_COCAGNE = 90938;

// Trimmed from the real 2026 GridSmart view: a plenum slot is listed under
// every room, a non-plenum one under its own room only.
function grid(changes: { lunchStart?: string; withoutAfter?: boolean } = {}) {
  const plenum = [
    { id: "g-breakfast", title: "Petit déjeuner", startsAt: `${YEAR}-11-19T08:00:00`, endsAt: `${YEAR}-11-19T08:45:00`, roomId: SZ_AGORA2 },
    { id: "g-keynote", title: "Keynote d'ouverture", startsAt: `${YEAR}-11-19T09:00:00`, endsAt: `${YEAR}-11-19T09:40:00`, roomId: SZ_AMPHI },
    { id: "g-break", title: "Pause", startsAt: `${YEAR}-11-19T10:35:00`, endsAt: `${YEAR}-11-19T11:00:00`, roomId: SZ_AMPHI },
    { id: "g-lunch", title: "Déjeuner", startsAt: changes.lunchStart ?? `${YEAR}-11-19T12:45:00`, endsAt: `${YEAR}-11-19T14:15:00`, roomId: SZ_AMPHI },
    ...(changes.withoutAfter ? [] : [{ id: "g-after", title: "After", startsAt: `${YEAR}-11-19T18:30:00`, endsAt: `${YEAR}-11-19T21:00:00`, roomId: SZ_AMPHI }]),
    { id: "g-filler-amphi", title: "Intermède", startsAt: `${YEAR}-11-19T09:40:00`, endsAt: `${YEAR}-11-19T09:50:00`, roomId: SZ_AMPHI },
  ].map((s) => ({ ...s, isServiceSession: true, isPlenumSession: true, speakers: [] }));
  const cocagneOnly = [
    { id: "g-workshop-setup", title: "Installation atelier", startsAt: `${YEAR}-11-19T13:00:00`, endsAt: `${YEAR}-11-19T13:30:00`, roomId: SZ_COCAGNE, isServiceSession: true, isPlenumSession: false, speakers: [] },
    { id: "g-filler-cocagne", title: "Intermède", startsAt: `${YEAR}-11-19T10:05:00`, endsAt: `${YEAR}-11-19T10:20:00`, roomId: SZ_COCAGNE, isServiceSession: true, isPlenumSession: false, speakers: [] },
    { id: "1001", title: "Un vrai talk", startsAt: `${YEAR}-11-19T10:00:00`, endsAt: `${YEAR}-11-19T10:45:00`, roomId: SZ_COCAGNE, isServiceSession: false, speakers: ["s1"] },
  ];
  return [
    {
      date: `${YEAR}-11-19T00:00:00`,
      rooms: [
        { id: SZ_AMPHI, name: "Amphi", sessions: plenum },
        { id: SZ_AGORA2, name: "Agora 2 (sponsors)", sessions: plenum },
        { id: SZ_COCAGNE, name: "Cocagne", sessions: [...plenum, ...cocagneOnly] },
      ],
    },
  ];
}

const allView = {
  speakers: [],
  categories: [],
  sessions: [],
  rooms: [
    { id: SZ_AMPHI, name: "Amphi", sort: 0 },
    { id: SZ_AGORA2, name: "Agora 2 (sponsors)", sort: 1 },
    { id: SZ_COCAGNE, name: "Cocagne", sort: 2 },
  ],
};

let editionId: number;
let cocagneId: number;

const entries = () => prisma.scheduleEntry.findMany({ where: { editionId }, orderBy: { startsAt: "asc" } });

describe("Sessionize service slots (#546)", () => {
  beforeAll(async () => {
    const venue = await prisma.venue.create({
      data: { name: VENUE, rooms: { create: [{ name: "Amphi", sortOrder: 0 }, { name: "Cocagne", sortOrder: 1 }] } },
      include: { rooms: true },
    });
    cocagneId = venue.rooms.find((room) => room.name === "Cocagne")!.id;
    editionId = (await prisma.edition.create({ data: { year: YEAR, venueId: venue.id } })).id;
  });

  beforeEach(async () => {
    await prisma.scheduleEntry.deleteMany({ where: { editionId } });
  });

  afterAll(async () => {
    await prisma.edition.delete({ where: { id: editionId } });
    await prisma.venue.delete({ where: { name: VENUE } });
  });

  it("should create one entry per service slot, at Paris time, without the fillers", async () => {
    const report = await importSessionize(editionId, allView, extractServiceSlots(grid()));
    const rows = await entries();

    expect(report.scheduleEntries).toEqual({ created: 6, updated: 0, deleted: 0 });
    expect(rows.map((e) => e.labelFr)).toEqual(["Petit déjeuner", "Keynote d'ouverture", "Pause", "Déjeuner", "Installation atelier", "After"]);
    expect(rows[0].startsAt.toISOString()).toBe(`${YEAR}-11-19T07:00:00.000Z`);
    expect(rows.map((e) => e.kind)).toEqual(["MEAL", "OTHER", "BREAK", "MEAL", "OTHER", "SOCIAL"]);
    expect(rows.find((e) => e.labelFr === "Pause")).toMatchObject({ labelEn: "Break", roomId: null });
    // Not plenum: it stays in its room.
    expect(rows.find((e) => e.labelFr === "Installation atelier")!.roomId).toBe(cocagneId);
  });

  it("should change nothing on a re-import of the same programme", async () => {
    await importSessionize(editionId, allView, extractServiceSlots(grid()));
    const again = await importSessionize(editionId, allView, extractServiceSlots(grid()));

    expect(again.scheduleEntries).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(await entries()).toHaveLength(6);
  });

  it("should move a slot moved in Sessionize and remove one Sessionize dropped", async () => {
    await importSessionize(editionId, allView, extractServiceSlots(grid()));
    const report = await importSessionize(editionId, allView, extractServiceSlots(grid({ lunchStart: `${YEAR}-11-19T12:30:00`, withoutAfter: true })));
    const rows = await entries();

    expect(report.scheduleEntries).toEqual({ created: 0, updated: 1, deleted: 1 });
    expect(rows.find((e) => e.labelFr === "Déjeuner")!.startsAt.toISOString()).toBe(`${YEAR}-11-19T11:30:00.000Z`);
    expect(rows.some((e) => e.labelFr === "After")).toBe(false);
  });

  it("should never touch an entry typed by hand", async () => {
    const own = await prisma.scheduleEntry.create({
      data: { editionId, kind: "OTHER", labelFr: "Photo de groupe", labelEn: "Group photo", startsAt: new Date(`${YEAR}-11-19T17:00:00Z`), endsAt: new Date(`${YEAR}-11-19T17:15:00Z`) },
    });
    await importSessionize(editionId, allView, extractServiceSlots(grid({ withoutAfter: true })));

    expect(await prisma.scheduleEntry.findUnique({ where: { id: own.id } })).toMatchObject({ labelFr: "Photo de groupe", sessionizeId: null });
  });

  it("should adopt a hand-made twin instead of duplicating it on the first import", async () => {
    // As on beta and production, where the slots were typed in on 2026-10-06.
    const typed = await prisma.scheduleEntry.create({
      data: { editionId, kind: "BREAK", labelFr: "pause", labelEn: "Coffee break", startsAt: new Date(`${YEAR}-11-19T09:35:00Z`), endsAt: new Date(`${YEAR}-11-19T10:00:00Z`) },
    });
    const report = await importSessionize(editionId, allView, extractServiceSlots(grid()));

    expect(report.scheduleEntries).toEqual({ created: 5, updated: 1, deleted: 0 });
    expect(await prisma.scheduleEntry.findUnique({ where: { id: typed.id } })).toMatchObject({ sessionizeId: "g-break", labelEn: "Coffee break" });
    expect(await entries()).toHaveLength(6);
  });

  it("should adopt a twin worded as a known variant", async () => {
    const typed = await prisma.scheduleEntry.create({
      data: { editionId, kind: "OTHER", labelFr: "Keynote d’ouverture", labelEn: "Opening keynote", startsAt: new Date(`${YEAR}-11-19T08:00:00Z`), endsAt: new Date(`${YEAR}-11-19T08:40:00Z`) },
    });
    await importSessionize(editionId, allView, extractServiceSlots(grid()));

    expect((await prisma.scheduleEntry.findUnique({ where: { id: typed.id } }))!.sessionizeId).toBe("g-keynote");
    expect(await entries()).toHaveLength(6);
  });

  it("should leave the entries alone when the import had no GridSmart view", async () => {
    await importSessionize(editionId, allView, extractServiceSlots(grid()));
    const report = await importSessionize(editionId, allView);

    expect(report.scheduleEntries).toBeNull();
    expect(await entries()).toHaveLength(6);
  });
});

describe("Sessionize service slot helpers (#546)", () => {
  it("should derive the GridSmart view from the link of another view", () => {
    expect(gridSmartUrl("https://sessionize.com/api/v2/exi1adpy/view/All")).toBe("https://sessionize.com/api/v2/exi1adpy/view/GridSmart");
    expect(gridSmartUrl("https://example.com/api/v2/x/view/All")).toBeNull();
  });

  it("should classify and translate the 2026 labels", () => {
    expect(slotKind("Petit déjeuner")).toBe("MEAL");
    expect(slotKind("Clôture")).toBe("OTHER");
    expect(englishLabel("Présentation de la journée")).toBe("Welcome");
    expect(englishLabel("Remise des prix")).toBe("Remise des prix");
  });
});
