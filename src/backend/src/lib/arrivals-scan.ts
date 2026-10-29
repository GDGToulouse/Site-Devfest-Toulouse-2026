import { createHash } from "node:crypto";

import { prisma } from "./prisma.js";
import { publishArrivals } from "./arrivals-stream.js";
import { HELP_ENTRY_SELECT, LIVE_BADGE_SELECT, moveBadge, toHelpEntry, toLiveBadge, type LiveBadge } from "./badge-state.js";
import type { BadgeState } from "../generated/prisma/client.js";

// The entrance (RG-ARR-30 to RG-ARR-35, #642): a ticket read or picked by
// name becomes an answer to say out loud — a number and a counter, or where
// else to send the person — and the badge shows up on its counter's screen.

/** What the volunteer reads back to check who stands in front of them. Never the email. */
export interface ScanAttendee {
  id: number;
  firstName: string;
  lastName: string;
  company: string | null;
  tierName: string | null;
}

export interface FirstScan {
  at: Date;
  by: string | null;
}

export type ScanOutcome =
  | { result: "unknown" }
  | { result: "cancelled"; attendee: ScanAttendee }
  | { result: "dedicated"; attendee: ScanAttendee; alreadyScanned: FirstScan | null }
  | { result: "help"; attendee: ScanAttendee; alreadyScanned: FirstScan | null }
  | { result: "badge"; attendee: ScanAttendee; badge: LiveBadge; alreadyScanned: FirstScan | null };

const SCAN_SELECT = {
  ...LIVE_BADGE_SELECT,
  isCancelled: true,
  scannedAt: true,
  scannedByLabel: true,
  ticketTier: { select: { nameFr: true, isOutsideFlow: true } },
} as const;

/**
 * Scan a ticket, by its code or by the attendee picked in a name search. The
 * first scan is recorded; a later one only reports it (RG-ARR-34), without
 * blocking. `isFirstScan` tells the caller to check the ticket in.
 */
export async function scanTicket(
  editionId: number,
  target: { barcode: string } | { attendeeId: number },
  actor: { id: string; label: string },
): Promise<{ outcome: ScanOutcome; isFirstScan: boolean }> {
  // A code shared by a live and a cancelled ticket (an exchange) means the live one.
  const row = await prisma.attendee.findFirst({
    where: { editionId, ...("barcode" in target ? { barcode: target.barcode } : { id: target.attendeeId }) },
    select: SCAN_SELECT,
    orderBy: [{ isCancelled: "asc" }, { id: "asc" }],
  });
  if (!row) return { outcome: { result: "unknown" }, isFirstScan: false };

  const attendee: ScanAttendee = {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    tierName: row.ticketTier?.nameFr ?? null,
  };
  if (row.isCancelled) return { outcome: { result: "cancelled", attendee }, isFirstScan: false };

  let alreadyScanned: FirstScan | null = row.scannedAt ? { at: row.scannedAt, by: row.scannedByLabel } : null;
  let isFirstScan = false;
  if (!alreadyScanned) {
    // Two phones reading the same ticket at once: one records it, the other
    // gets the alert.
    const claimed = await prisma.attendee.updateMany({
      where: { id: row.id, scannedAt: null },
      data: { scannedAt: new Date(), scannedByLabel: actor.label },
    });
    isFirstScan = claimed.count === 1;
    if (!isFirstScan) {
      const first = await prisma.attendee.findUnique({ where: { id: row.id }, select: { scannedAt: true, scannedByLabel: true } });
      if (first?.scannedAt) alreadyScanned = { at: first.scannedAt, by: first.scannedByLabel };
    }
  }

  if (row.ticketTier?.isOutsideFlow) {
    return { outcome: { result: "dedicated", attendee, alreadyScanned }, isFirstScan };
  }

  if (row.badgeNumber === null) {
    if (isFirstScan) {
      const entry = await prisma.attendee.findUnique({ where: { id: row.id }, select: HELP_ENTRY_SELECT });
      if (entry) publishArrivals(editionId, { type: "help", data: toHelpEntry(entry) });
    }
    return { outcome: { result: "help", attendee, alreadyScanned }, isFirstScan };
  }

  // A badge an admin sent back to Imprimé goes back to its counter on the
  // next scan, alert or not: the person is here.
  let badge = toLiveBadge(row);
  if (badge.state === "PRINTED") {
    const moved = await moveBadge(editionId, row.id, "PRINTED", "TO_FETCH", actor);
    if (moved) badge = moved.badge;
  }
  return { outcome: { result: "badge", attendee, badge, alreadyScanned }, isFirstScan };
}

export interface SearchHit extends ScanAttendee {
  badgeNumber: number | null;
  /** Meaningful with a number only (RG-ARR-50). */
  badgeState: BadgeState;
  isCancelled: boolean;
  isDedicated: boolean;
  scannedAt: Date | null;
  /** The help desk's labels (#713): how many printed, and whether one was handed over. */
  labelCount: number;
  labelDeliveredAt: Date | null;
}

/** Results one search returns: the volunteer narrows down by typing more. */
const SEARCH_RESULT_LIMIT = 20;

// "Hélène" must come up for "helene": typed on a phone, in a queue.
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Search by first and/or last name (RG-ARR-31): every word typed must start a
 * word of the name. Filtered here rather than in SQL because Postgres has no
 * accent folding without the unaccent extension; the read is bounded by the
 * edition's tickets (about 1,500 short rows).
 */
export async function searchAttendees(editionId: number, query: string): Promise<SearchHit[]> {
  const words = fold(query).split(/[\s'-]+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const rows = await prisma.attendee.findMany({
    where: { editionId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      badgeNumber: true,
      badgeState: true,
      isCancelled: true,
      scannedAt: true,
      labelDeliveredAt: true,
      _count: { select: { badgeLabels: true } },
      ticketTier: { select: { nameFr: true, isOutsideFlow: true } },
    },
  });
  return rows
    .filter((row) => {
      const nameWords = fold(`${row.firstName} ${row.lastName}`).split(/[\s'-]+/);
      return words.every((w) => nameWords.some((n) => n.startsWith(w)));
    })
    .sort((a, b) => Number(a.isCancelled) - Number(b.isCancelled) || a.lastName.localeCompare(b.lastName, "fr"))
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      company: row.company,
      tierName: row.ticketTier?.nameFr ?? null,
      badgeNumber: row.badgeNumber,
      badgeState: row.badgeState,
      isCancelled: row.isCancelled,
      isDedicated: row.ticketTier?.isOutsideFlow ?? false,
      scannedAt: row.scannedAt,
      labelCount: row._count.badgeLabels,
      labelDeliveredAt: row.labelDeliveredAt,
    }));
}

/**
 * Hex digits of the code's digest the degraded-mode table keeps (RG-ARR-65):
 * 24 bits. A lost phone's table then matches some 900,000 of the ten billion
 * possible 10-digit codes for 1,500 real ones, so it does not hand out valid
 * tickets; and two real codes rarely share a key (marked ambiguous if so).
 */
export const OFFLINE_KEY_HEX_LENGTH = 6;

/** In the table: a badge number, or one of these. */
export const OFFLINE_DEDICATED = 0;
export const OFFLINE_AMBIGUOUS = -1;

/** Same computation in the browser (lib/arrivals-offline.ts): edition, then the code as read. */
export function offlineKey(editionId: number, code: string): string {
  return createHash("sha256")
    .update(`devfest-arrivals:${editionId}:${code.trim()}`)
    .digest("hex")
    .slice(0, OFFLINE_KEY_HEX_LENGTH);
}

export interface OfflineTable {
  editionId: number;
  keyLength: number;
  /** When the phone must erase it: the day after the event, null while the date is unknown. */
  expiresAt: Date | null;
  entries: Record<string, number>;
}

/**
 * The degraded mode's table (RG-ARR-64, RG-ARR-65): code digest → badge
 * number, or the dedicated flow. No name, no code. A ticket without a number
 * is left out: the phone then sends that person to the help desk, which is
 * where the backend would have sent them too.
 */
export async function buildOfflineTable(editionId: number): Promise<OfflineTable | null> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { startDate: true, endDate: true },
  });
  if (!edition) return null;
  const rows = await prisma.attendee.findMany({
    where: {
      editionId,
      isCancelled: false,
      OR: [{ badgeNumber: { not: null } }, { ticketTier: { isOutsideFlow: true } }],
    },
    select: { barcode: true, badgeNumber: true },
  });

  const entries: Record<string, number> = {};
  for (const row of rows) {
    const key = offlineKey(editionId, row.barcode);
    const value = row.badgeNumber ?? OFFLINE_DEDICATED;
    entries[key] = key in entries && entries[key] !== value ? OFFLINE_AMBIGUOUS : value;
  }

  const eventDay = edition.endDate ?? edition.startDate;
  const expiresAt = eventDay ? new Date(eventDay.getTime() + 24 * 60 * 60 * 1000) : null;
  return { editionId, keyLength: OFFLINE_KEY_HEX_LENGTH, expiresAt, entries };
}
