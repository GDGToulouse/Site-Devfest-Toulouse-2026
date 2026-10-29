import type { BadgeState } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

// The team's tracking screen (RG-ARR-26, RG-ARR-62, #644): where the welcome
// stands, to move volunteers where the queue grows. Totals only, computed
// here: the volunteers' stream carries neither the tickets not yet scanned
// nor the dedicated flow, and a screen for ADMIN and EDITOR has no use for
// the names.

export interface CounterTotals {
  counter: number;
  /** Badges numbered for this counter. */
  numbered: number;
  toFetch: number;
  ready: number;
  delivered: number;
}

export interface TrackingSummary {
  /** Tickets through the counters and the help desk: not cancelled, not the dedicated flow. */
  expected: number;
  scanned: number;
  /** By the counters or as a help desk label. */
  delivered: number;
  /** To fetch or ready at a counter. */
  waiting: number;
  counters: CounterTotals[];
  dedicated: { expected: number; scanned: number };
  help: {
    /** Scanned without a number, no label handed over yet. */
    toHandle: number;
    labelsDelivered: number;
    labelsPrinted: number;
  };
}

export interface TrackingRow {
  badgeNumber: number | null;
  badgeState: BadgeState;
  isDedicated: boolean;
  isScanned: boolean;
  isLabelDelivered: boolean;
}

/** The totals over an edition's live tickets (cancelled ones left out by the caller). */
export function summarize(rows: TrackingRow[], counters: number, labelsPrinted: number): TrackingSummary {
  const summary: TrackingSummary = {
    expected: 0,
    scanned: 0,
    delivered: 0,
    waiting: 0,
    counters: Array.from({ length: counters }, (_, i) => ({
      counter: i + 1,
      numbered: 0,
      toFetch: 0,
      ready: 0,
      delivered: 0,
    })),
    dedicated: { expected: 0, scanned: 0 },
    help: { toHandle: 0, labelsDelivered: 0, labelsPrinted },
  };

  for (const row of rows) {
    if (row.isDedicated) {
      summary.dedicated.expected++;
      if (row.isScanned) summary.dedicated.scanned++;
      continue;
    }
    summary.expected++;
    if (row.isScanned) summary.scanned++;
    if (row.isLabelDelivered) {
      // Counted apart, off its counter's bar (RG-ARR-52).
      summary.delivered++;
      summary.help.labelsDelivered++;
      continue;
    }
    if (row.badgeNumber === null) {
      if (row.isScanned) summary.help.toHandle++;
      continue;
    }

    const counter = summary.counters[Math.floor(row.badgeNumber / 1000) - 1];
    if (counter) counter.numbered++;
    if (row.badgeState === "DELIVERED") {
      summary.delivered++;
      if (counter) counter.delivered++;
    } else if (row.badgeState === "TO_FETCH" || row.badgeState === "READY") {
      summary.waiting++;
      if (counter) counter[row.badgeState === "TO_FETCH" ? "toFetch" : "ready"]++;
    }
  }
  return summary;
}

/** One read of the edition's tickets (about 1,500 short rows) and one count. */
export async function loadTrackingSummary(editionId: number): Promise<TrackingSummary | null> {
  const edition = await prisma.edition.findUnique({ where: { id: editionId }, select: { badgeCounters: true } });
  if (!edition) return null;
  const rows = await prisma.attendee.findMany({
    where: { editionId, isCancelled: false },
    select: {
      badgeNumber: true,
      badgeState: true,
      scannedAt: true,
      labelDeliveredAt: true,
      ticketTier: { select: { isOutsideFlow: true } },
    },
  });
  const labelsPrinted = await prisma.badgeLabel.count({ where: { attendee: { editionId } } });
  return summarize(
    rows.map((row) => ({
      badgeNumber: row.badgeNumber,
      badgeState: row.badgeState,
      isDedicated: row.ticketTier?.isOutsideFlow ?? false,
      isScanned: row.scannedAt !== null,
      isLabelDelivered: row.labelDeliveredAt !== null,
    })),
    edition.badgeCounters,
    labelsPrinted,
  );
}
