import { describe, it, expect } from "vitest";
import {
  assignBadgeNumbers,
  badgeSlot,
  capacityShortfall,
  formatBadgeNumber,
  slotOfNumber,
  type NumberableTicket,
} from "./badge-numbering.js";

const FOUR_BY_THREE = { counters: 4, binsPerCounter: 3, badgesPerBin: 99 };

function ticket(i: number, overrides: Partial<NumberableTicket> = {}): NumberableTicket {
  return {
    orderDate: new Date(Date.UTC(2026, 8, 1) + i * 60_000),
    orderId: String(1000 + i),
    billetwebId: String(5000 + i),
    ...overrides,
  };
}

const tickets = (count: number) => Array.from({ length: count }, (_, i) => ticket(i));

describe("badgeSlot (#639, #774)", () => {
  it("should give the first twelve tickets rank 1 across every counter and bin, all counted from 1", () => {
    const numbers = Array.from({ length: 12 }, (_, i) => badgeSlot(i + 1, FOUR_BY_THREE).number);
    expect(numbers).toEqual([1101, 2101, 3101, 4101, 1201, 2201, 3201, 4201, 1301, 2301, 3301, 4301]);
  });

  it("should give the 1188th ticket the last slot of the last bin", () => {
    expect(badgeSlot(1188, FOUR_BY_THREE)).toEqual({ number: 4399, counter: 4, bin: 3, rank: 99 });
  });

  it("should follow other layouts than 4 × 3", () => {
    expect(badgeSlot(7, { counters: 3, binsPerCounter: 4, badgesPerBin: 99 })).toEqual({ number: 1301, counter: 1, bin: 3, rank: 1 });
  });

  it("should read a number back into its counter, bin and rank", () => {
    expect(slotOfNumber(2147)).toEqual({ counter: 2, bin: 1, rank: 47 });
  });

  it("should show the number as counter, bin and a two-digit rank", () => {
    expect(formatBadgeNumber(1225)).toBe("1 2 25");
    expect(formatBadgeNumber(1205)).toBe("1 2 05");
    expect(formatBadgeNumber(4399)).toBe("4 3 99");
  });
});

describe("assignBadgeNumbers (#639)", () => {
  it("should fill each of the twelve bins with exactly ranks 1 to 99 for 1188 tickets", () => {
    const numbers = assignBadgeNumbers(tickets(1188), FOUR_BY_THREE).map((t) => t.number);
    const everySlot = [1, 2, 3, 4].flatMap((counter) =>
      [1, 2, 3].flatMap((bin) => Array.from({ length: 99 }, (_, i) => counter * 1000 + bin * 100 + i + 1)),
    );
    expect(numbers.sort((a, b) => a - b)).toEqual(everySlot);
  });

  it("should send an order of five tickets to counters 1, 2, 3, 4 then 1", () => {
    const date = new Date("2026-09-01T08:00:00Z");
    const order = [5, 3, 1, 4, 2].map((i) => ticket(i, { orderDate: date, orderId: "77", billetwebId: String(900 + i) }));
    const numbered = assignBadgeNumbers(order, FOUR_BY_THREE);
    expect(numbered.map((t) => [t.billetwebId, t.counter])).toEqual([
      ["901", 1], ["902", 2], ["903", 3], ["904", 4], ["905", 1],
    ]);
  });

  it("should break a tie on the order date by order id, as numbers", () => {
    const date = new Date("2026-09-01T08:00:00Z");
    const numbered = assignBadgeNumbers(
      [ticket(0, { orderDate: date, orderId: "100" }), ticket(1, { orderDate: date, orderId: "99" })],
      FOUR_BY_THREE,
    );
    expect(numbered.map((t) => t.orderId)).toEqual(["99", "100"]);
  });

  it("should give the same numbers whatever order the tickets come in", () => {
    const shuffled = tickets(50).reverse();
    expect(assignBadgeNumbers(shuffled, FOUR_BY_THREE)).toEqual(assignBadgeNumbers(tickets(50), FOUR_BY_THREE));
  });
});

describe("capacityShortfall (#639)", () => {
  it("should accept exactly the capacity", () => {
    expect(capacityShortfall(1188, FOUR_BY_THREE)).toBeNull();
  });

  it("should refuse one ticket more, with a bin missing at every counter", () => {
    expect(capacityShortfall(1189, FOUR_BY_THREE)).toEqual({ capacity: 1188, missingBins: 4, binsPerCounterNeeded: 4 });
  });

  it("should count with the bins' own size when they hold fewer than 99 badges", () => {
    const smallBins = { ...FOUR_BY_THREE, badgesPerBin: 80 };

    expect(capacityShortfall(960, smallBins)).toBeNull();
    expect(capacityShortfall(961, smallBins)).toEqual({ capacity: 960, missingBins: 4, binsPerCounterNeeded: 4 });
  });

  it("should keep the ranks of a smaller bin within its size, from 1", () => {
    const smallBins = { ...FOUR_BY_THREE, badgesPerBin: 80 };

    const ranks = assignBadgeNumbers(tickets(960), smallBins).map((t) => t.rank);

    expect(Math.max(...ranks)).toBe(80);
  });
});
