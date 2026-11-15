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
  formatBadgeNumber,
  fromSnapshot,
  withdrawHelp,
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
  isRefunded: false,
  isWithdrawn: false,
  firstName: "Camille",
  lastName: "Test",
  company: null,
});

const snapshot = (badges: LiveBadge[]) =>
  fromSnapshot({ layout: { counters: 3, binsPerCounter: 2 }, frozenAt: null, badges, help: [], withdrawals: [] });

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

  it("should keep a refunded badge on its counter until the help desk takes it back (#800)", () => {
    const refunded = { ...badge(1, 1101, "READY", 2), isRefunded: true };

    const before = counterBoard(snapshot([refunded]), 1);
    const after = counterBoard(applyBadge(snapshot([refunded]), { ...refunded, version: 3, isWithdrawn: true }), 1);

    expect(before.ready.map((b) => b.id)).toEqual([1]);
    expect(after.ready).toEqual([]);
  });

  it("should take a help desk ticket off the list when its scan is cancelled (#797)", () => {
    const entry = {
      id: 9,
      firstName: "Paul",
      lastName: "Test",
      company: null,
      tierName: null,
      scannedAt: "2026-11-19T08:00:00Z",
      labelDeliveredAt: null,
    };

    const state = withdrawHelp(applyHelp(applyHelp(snapshot([]), entry), { ...entry, id: 10 }), 9);

    expect(state.help.map((h) => h.id)).toEqual([10]);
  });

  it("should take a badge handed over as a label off its counter's board and loads (#713)", () => {
    const state = snapshot([{ ...badge(1, 1101, "DELIVERED", 2), byLabel: true }, badge(2, 1102, "DELIVERED", 2)]);

    expect(counterBoard(state, 1).delivered.map((b) => b.number)).toEqual([1102]);
    expect(counterLoads(state)[0].delivered).toBe(1);
  });

  it("should read the counter and the bin from the badge number", () => {
    expect([counterOf(2307), binOf(2307)]).toEqual([2, 3]);
  });

  it("should show the number as counter, bin and a two-digit rank (#774)", () => {
    expect([formatBadgeNumber(1225), formatBadgeNumber(1205), formatBadgeNumber(4399)]).toEqual(["1 2 25", "1 2 05", "4 3 99"]);
  });

  it("should give each bin of a counter its own colour, from bin 1", () => {
    const colours = [binColor(binOf(2125)), binColor(binOf(2225)), binColor(binOf(2325))];

    expect(new Set(colours).size).toBe(3);
    expect(colours[0]).toBe("bg-malachite");
  });

  it("should lay out a counter's kanban: oldest first to fetch and ready, latest first delivered (#643)", () => {
    const state = snapshot([
      badge(1, 1201, "TO_FETCH", 1, "2026-11-19T08:05:00Z"),
      badge(2, 1101, "TO_FETCH", 1, "2026-11-19T08:01:00Z"),
      badge(3, 2101, "TO_FETCH", 1, "2026-11-19T08:00:00Z"),
      badge(4, 1102, "READY", 2, "2026-11-19T08:03:00Z"),
      badge(5, 1103, "DELIVERED", 3, "2026-11-19T08:02:00Z"),
      badge(6, 1104, "DELIVERED", 3, "2026-11-19T08:04:00Z"),
    ]);

    const board = counterBoard(state, 1);

    expect(board.toFetch.map((b) => b.number)).toEqual([1101, 1201]);
    expect(board.ready.map((b) => b.number)).toEqual([1102]);
    expect(board.delivered.map((b) => b.number)).toEqual([1104, 1103]);
    expect(board.toFetchByBin).toEqual([1, 1]);
  });

  it("should put a card sent back to fetch at its place by scan time, not at the end", () => {
    const sentBack = {
      ...badge(1, 1101, "TO_FETCH", 3, "2026-11-19T08:10:00Z"),
      scannedAt: "2026-11-19T08:00:00Z",
    };
    const later = { ...badge(2, 1102, "TO_FETCH", 1, "2026-11-19T08:05:00Z"), scannedAt: "2026-11-19T08:05:00Z" };

    expect(counterBoard(snapshot([later, sentBack]), 1).toFetch.map((b) => b.number)).toEqual([1101, 1102]);
  });

  it("should keep only the latest delivered cards in view", () => {
    const delivered = Array.from({ length: DELIVERED_SHOWN + 2 }, (_, i) =>
      badge(i + 1, 1100 + i, "DELIVERED", 3, `2026-11-19T08:${String(10 + i).padStart(2, "0")}:00Z`),
    );

    const board = counterBoard(snapshot(delivered), 1);

    expect(board.delivered).toHaveLength(DELIVERED_SHOWN);
    expect(board.delivered[0].number).toBe(1100 + DELIVERED_SHOWN + 1);
  });

  it("should show every bin of the counter, and count what waits in each", () => {
    const state = snapshot([badge(1, 1101, "TO_FETCH", 1), badge(2, 1201, "TO_FETCH", 1), badge(3, 1202, "READY", 2)]);

    const board = counterBoard(state, 1);

    expect(board.toFetch.map((b) => b.number)).toEqual([1101, 1201]);
    expect(board.ready.map((b) => b.number)).toEqual([1202]);
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
