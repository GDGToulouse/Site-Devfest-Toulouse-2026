// Badge numbers (RG-ARR-15 to RG-ARR-17, #639): counter × 1000 + bin × 100 + rank.
// Pure functions, so two runs before the freeze give the same numbering.

export const BADGES_PER_BIN = 100;
// One digit each in the number: counters 1 to 9, bins 0 to 9.
export const MAX_COUNTERS = 9;
export const MAX_BINS_PER_COUNTER = 10;

export interface BadgeLayout {
  counters: number;
  binsPerCounter: number;
}

export interface NumberableTicket {
  orderDate: Date;
  orderId: string;
  billetwebId: string;
}

export interface BadgeSlot {
  number: number;
  counter: number;
  bin: number;
  rank: number;
}

/** The n-th ticket's slot, n from 1: one ticket per counter in turn, then the next bin. */
export function badgeSlot(n: number, { counters, binsPerCounter }: BadgeLayout): BadgeSlot {
  const counter = ((n - 1) % counters) + 1;
  const bin = Math.floor((n - 1) / counters) % binsPerCounter;
  const rank = Math.floor((n - 1) / (counters * binsPerCounter));
  return { number: counter * 1000 + bin * 100 + rank, counter, bin, rank };
}

export function slotOfNumber(number: number): Omit<BadgeSlot, "number"> {
  return { counter: Math.floor(number / 1000), bin: Math.floor(number / 100) % 10, rank: number % 100 };
}

export function badgeCapacity({ counters, binsPerCounter }: BadgeLayout): number {
  return counters * binsPerCounter * BADGES_PER_BIN;
}

/**
 * What it takes to number `count` tickets: bins are added to every counter at
 * once, since the round robin fills them all alike (RG-ARR-17).
 */
export function capacityShortfall(count: number, layout: BadgeLayout) {
  const capacity = badgeCapacity(layout);
  if (count <= capacity) return null;
  const binsPerCounterNeeded = Math.ceil(count / (layout.counters * BADGES_PER_BIN));
  return {
    capacity,
    missingBins: (binsPerCounterNeeded - layout.binsPerCounter) * layout.counters,
    binsPerCounterNeeded,
  };
}

// Billetweb ids are digit strings: shorter means smaller, then compare as text.
function compareIds(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/** Purchase order (RG-ARR-16): order date, then order, then ticket. */
export function comparePurchaseOrder(a: NumberableTicket, b: NumberableTicket): number {
  return (
    a.orderDate.getTime() - b.orderDate.getTime() ||
    compareIds(a.orderId, b.orderId) ||
    compareIds(a.billetwebId, b.billetwebId)
  );
}

/** Numbers the tickets in purchase order; the caller checks the capacity first. */
export function assignBadgeNumbers<T extends NumberableTicket>(
  tickets: T[],
  layout: BadgeLayout,
): Array<T & BadgeSlot> {
  return [...tickets].sort(comparePurchaseOrder).map((t, i) => ({ ...t, ...badgeSlot(i + 1, layout) }));
}
