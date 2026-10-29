import { describe, it, expect } from "vitest";

import { applyBadge, applyHelp, binColor, binOf, counterLoads, counterOf, fromSnapshot, type LiveBadge } from "./arrivals-live";

const badge = (id: number, number: number, state: LiveBadge["state"], version: number): LiveBadge => ({
  id,
  number,
  state,
  version,
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
    const entry = { id: 9, firstName: "Paul", lastName: "Test", company: null, tierName: null, scannedAt: "2026-11-19T08:00:00Z" };

    const state = applyHelp(applyHelp(snapshot([]), entry), entry);

    expect(state.help).toEqual([entry]);
  });

  it("should read the counter and the bin from the badge number", () => {
    expect([counterOf(2307), binOf(2307)]).toEqual([2, 3]);
  });

  it("should give each bin of a counter its own colour, from bin 0", () => {
    const colours = [binColor(binOf(2047)), binColor(binOf(2147)), binColor(binOf(2247))];

    expect(new Set(colours).size).toBe(3);
    expect(colours[0]).toBe("bg-malachite");
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
