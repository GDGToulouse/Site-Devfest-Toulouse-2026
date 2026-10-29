import { describe, it, expect } from "vitest";

import {
  DELIVERED_SHOWN,
  applyBadge,
  applyHelp,
  binColor,
  binOf,
  counterBoard,
  counterLoads,
  counterOf,
  fromSnapshot,
  type LiveBadge,
} from "./arrivals-live";

const badge = (id: number, number: number, state: LiveBadge["state"], version: number, since: string | null = null): LiveBadge => ({
  id,
  number,
  state,
  version,
  since,
  byLabel: false,
  scannedOffline: false,
  scannedAt: null,
  firstName: "Camille",
  lastName: "Test",
  company: null,
});

const snapshot = (badges: LiveBadge[]) =>
  fromSnapshot({ layout: { counters: 3, binsPerCounter: 2 }, frozenAt: null, badges, help: [] });

describe("the live state of the arrivals screens (#641)", () => {
  it("should apply a move newer than what the screen holds", () => {
    const state = snapshot([badge(1, 1101, "TO_FETCH", 1)]);

    const next = applyBadge(state, badge(1, 1101, "READY", 2));

    expect(next.badges.get(1)?.state).toBe("READY");
  });

  it("should skip a move the snapshot already holds, queued while it loaded", () => {
    const state = snapshot([badge(1, 1101, "READY", 2)]);

    const next = applyBadge(state, badge(1, 1101, "TO_FETCH", 1));

    expect(next).toBe(state);
  });

  it("should drop a badge sent back to Imprimé", () => {
    const state = snapshot([badge(1, 1101, "TO_FETCH", 1)]);

    const next = applyBadge(state, badge(1, 1101, "PRINTED", 2));

    expect(next.badges.has(1)).toBe(false);
  });

  it("should replace everything on a new snapshot, badges gone while away included", () => {
    const before = applyBadge(snapshot([badge(1, 1101, "TO_FETCH", 1)]), badge(2, 2101, "READY", 3));

    const after = snapshot([badge(3, 3101, "DELIVERED", 4)]);

    expect([...before.badges.keys()]).toEqual([1, 2]);
    expect([...after.badges.keys()]).toEqual([3]);
  });

  it("should list a ticket sent to the help desk once, however often it is announced", () => {
    const entry = {
      id: 9,
      firstName: "Paul",
      lastName: "Test",
      company: null,
      tierName: null,
      scannedAt: "2026-11-19T08:00:00Z",
      labelDeliveredAt: null,
    };

    const state = applyHelp(applyHelp(snapshot([]), entry), entry);

    expect(state.help).toEqual([entry]);
  });

  it("should mark a help desk ticket done in place once its label is handed over (#713)", () => {
    const entry = {
      id: 9,
      firstName: "Paul",
      lastName: "Test",
      company: null,
      tierName: null,
      scannedAt: "2026-11-19T08:00:00Z",
      labelDeliveredAt: null,
    };
    const done = { ...entry, labelDeliveredAt: "2026-11-19T08:05:00Z" };

    const state = applyHelp(applyHelp(snapshot([]), entry), done);

    expect(state.help).toEqual([done]);
  });

  it("should take a badge handed over as a label off its counter's board and loads (#713)", () => {
    const state = snapshot([{ ...badge(1, 1001, "DELIVERED", 2), byLabel: true }, badge(2, 1002, "DELIVERED", 2)]);

    expect(counterBoard(state, 1, null).delivered.map((b) => b.number)).toEqual([1002]);
    expect(counterLoads(state)[0].delivered).toBe(1);
  });

  it("should read the counter and the bin from the badge number", () => {
    expect([counterOf(2307), binOf(2307)]).toEqual([2, 3]);
  });

  it("should give each bin of a counter its own colour, from bin 0", () => {
    const colours = [binColor(binOf(2047)), binColor(binOf(2147)), binColor(binOf(2247))];

    expect(new Set(colours).size).toBe(3);
    expect(colours[0]).toBe("bg-malachite");
  });

  it("should lay out a counter's kanban: oldest first to fetch and ready, latest first delivered (#643)", () => {
    const state = snapshot([
      badge(1, 1101, "TO_FETCH", 1, "2026-11-19T08:05:00Z"),
      badge(2, 1001, "TO_FETCH", 1, "2026-11-19T08:01:00Z"),
      badge(3, 2001, "TO_FETCH", 1, "2026-11-19T08:00:00Z"),
      badge(4, 1002, "READY", 2, "2026-11-19T08:03:00Z"),
      badge(5, 1003, "DELIVERED", 3, "2026-11-19T08:02:00Z"),
      badge(6, 1004, "DELIVERED", 3, "2026-11-19T08:04:00Z"),
    ]);

    const board = counterBoard(state, 1, null);

    expect(board.toFetch.map((b) => b.number)).toEqual([1001, 1101]);
    expect(board.ready.map((b) => b.number)).toEqual([1002]);
    expect(board.delivered.map((b) => b.number)).toEqual([1004, 1003]);
    expect(board.toFetchByBin).toEqual([1, 1]);
  });

  it("should put a card sent back to fetch at its place by scan time, not at the end", () => {
    const sentBack = {
      ...badge(1, 1001, "TO_FETCH", 3, "2026-11-19T08:10:00Z"),
      scannedAt: "2026-11-19T08:00:00Z",
    };
    const later = { ...badge(2, 1002, "TO_FETCH", 1, "2026-11-19T08:05:00Z"), scannedAt: "2026-11-19T08:05:00Z" };

    expect(counterBoard(snapshot([later, sentBack]), 1, null).toFetch.map((b) => b.number)).toEqual([1001, 1002]);
  });

  it("should keep only the latest delivered cards in view", () => {
    const delivered = Array.from({ length: DELIVERED_SHOWN + 2 }, (_, i) =>
      badge(i + 1, 1000 + i, "DELIVERED", 3, `2026-11-19T08:${String(10 + i).padStart(2, "0")}:00Z`),
    );

    const board = counterBoard(snapshot(delivered), 1, null);

    expect(board.delivered).toHaveLength(DELIVERED_SHOWN);
    expect(board.delivered[0].number).toBe(1000 + DELIVERED_SHOWN + 1);
  });

  it("should narrow the board to one bin, and still count what waits in the others", () => {
    const state = snapshot([badge(1, 1001, "TO_FETCH", 1), badge(2, 1101, "TO_FETCH", 1), badge(3, 1102, "READY", 2)]);

    const board = counterBoard(state, 1, 0);

    expect(board.toFetch.map((b) => b.number)).toEqual([1001]);
    expect(board.ready).toEqual([]);
    expect(board.toFetchByBin).toEqual([1, 1]);
  });

  it("should count each counter's cards by column, idle counters included", () => {
    const state = snapshot([
      badge(1, 1101, "TO_FETCH", 1),
      badge(2, 1205, "READY", 2),
      badge(3, 3101, "DELIVERED", 3),
    ]);

    expect(counterLoads(state)).toEqual([
      { counter: 1, toFetch: 1, ready: 1, delivered: 0 },
      { counter: 2, toFetch: 0, ready: 0, delivered: 0 },
      { counter: 3, toFetch: 0, ready: 0, delivered: 1 },
    ]);
  });
});
