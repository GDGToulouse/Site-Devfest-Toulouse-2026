import type { BadgeState } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { publishArrivals } from "./arrivals-stream.js";

// The event-day life of a numbered badge (RG-ARR-40 to RG-ARR-46, #641):
// Imprimé → À chercher → Prêt → Distribué, each step reversible. There is no
// "taken" state: a move names the state it starts from, and the database
// applies it only if the badge is still there (RG-ARR-44), so two screens
// touching the same card cannot both win.

export const BADGE_STATES = ["PRINTED", "TO_FETCH", "READY", "DELIVERED"] as const satisfies readonly BadgeState[];

/** What a screen shows of a badge: never the email (RG-ARR-13). */
export interface LiveBadge {
  id: number;
  number: number;
  state: BadgeState;
  version: number;
  /** When it reached `state`: orders the counter's columns (RG-ARR-41). */
  since: Date | null;
  /** Handed over as a label at the help desk: off its counter's screen (RG-ARR-52). */
  byLabel: boolean;
  firstName: string;
  lastName: string;
  company: string | null;
}

export const LIVE_BADGE_SELECT = {
  id: true,
  badgeNumber: true,
  badgeState: true,
  badgeStateVersion: true,
  badgeStateAt: true,
  labelDeliveredAt: true,
  firstName: true,
  lastName: true,
  company: true,
} as const;

type LiveBadgeRow = {
  id: number;
  badgeNumber: number | null;
  badgeState: BadgeState;
  badgeStateVersion: number;
  badgeStateAt: Date | null;
  labelDeliveredAt: Date | null;
  firstName: string;
  lastName: string;
  company: string | null;
};

export function toLiveBadge(row: LiveBadgeRow): LiveBadge {
  return {
    id: row.id,
    // Only numbered badges are selected: the dedicated flow never moves.
    number: row.badgeNumber ?? 0,
    state: row.badgeState,
    version: row.badgeStateVersion,
    since: row.badgeStateAt,
    byLabel: row.labelDeliveredAt !== null,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
  };
}

const order = (state: BadgeState) => BADGE_STATES.indexOf(state);

/**
 * The moves a counter makes by touching its cards (RG-ARR-43): one step either
 * way between À chercher, Prêt and Distribué. Leaving Imprimé is the scan's
 * (#642), which also checks the ticket in; going back to it is an admin's.
 */
export function isCounterMove(from: BadgeState, to: BadgeState): boolean {
  return from !== "PRINTED" && to !== "PRINTED" && Math.abs(order(from) - order(to)) === 1;
}

/** An admin may take any badge one step back (RG-ARR-46). */
export function isStepBack(from: BadgeState, to: BadgeState): boolean {
  return order(from) - order(to) === 1;
}

/**
 * A scanned ticket with no number, sent to the help desk (RG-ARR-33): bought
 * after the freeze, or in a tier the site does not know. Its own list, since
 * it has no badge to move.
 */
export interface HelpEntry {
  id: number;
  firstName: string;
  lastName: string;
  company: string | null;
  tierName: string | null;
  scannedAt: Date;
  /** Label handed over: off the help desk's "to handle" list (RG-ARR-53). */
  labelDeliveredAt: Date | null;
}

export const HELP_ENTRY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  scannedAt: true,
  labelDeliveredAt: true,
  ticketTier: { select: { nameFr: true } },
} as const;

export function toHelpEntry(row: {
  id: number;
  firstName: string;
  lastName: string;
  company: string | null;
  scannedAt: Date | null;
  labelDeliveredAt: Date | null;
  ticketTier: { nameFr: string } | null;
}): HelpEntry {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    tierName: row.ticketTier?.nameFr ?? null,
    // Only scanned rows are selected.
    scannedAt: row.scannedAt ?? new Date(0),
    labelDeliveredAt: row.labelDeliveredAt,
  };
}

/** The tickets that belong at the help desk once scanned: no number, not the dedicated flow. */
export const helpDeskTickets = (editionId: number) => ({
  editionId,
  isCancelled: false,
  badgeNumber: null,
  OR: [{ ticketTierId: null }, { ticketTier: { isOutsideFlow: false } }],
});

export interface ArrivalsSnapshot {
  layout: { counters: number; binsPerCounter: number };
  frozenAt: Date | null;
  /** Every badge that left Imprimé: the rest is implied. */
  badges: LiveBadge[];
  /** Scanned tickets without a number, oldest first. */
  help: HelpEntry[];
}

/**
 * The full state a screen starts from, and restarts from after a break in the
 * stream (RG-ARR-61). Bounded by the edition's tickets (about 1,500).
 */
export async function loadArrivalsSnapshot(editionId: number): Promise<ArrivalsSnapshot | null> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { badgeCounters: true, badgeBinsPerCounter: true, badgesFrozenAt: true },
  });
  if (!edition) return null;
  const rows = await prisma.attendee.findMany({
    where: { editionId, badgeNumber: { not: null }, badgeState: { not: "PRINTED" } },
    select: LIVE_BADGE_SELECT,
    orderBy: { badgeNumber: "asc" },
  });
  const help = await prisma.attendee.findMany({
    where: { ...helpDeskTickets(editionId), scannedAt: { not: null } },
    select: HELP_ENTRY_SELECT,
    orderBy: { scannedAt: "asc" },
  });
  return {
    layout: { counters: edition.badgeCounters, binsPerCounter: edition.badgeBinsPerCounter },
    frozenAt: edition.badgesFrozenAt,
    badges: rows.map(toLiveBadge),
    help: help.map(toHelpEntry),
  };
}

export type MoveResult = { applied: boolean; badge: LiveBadge };

/**
 * Move a badge from `from` to `to`, if it is still in `from`. Returns the badge
 * as it now stands either way, so a screen that lost the race resynchronizes
 * (RG-ARR-44); null when the edition has no such numbered badge. Who may make
 * which move is the caller's to decide.
 */
export async function moveBadge(
  editionId: number,
  attendeeId: number,
  from: BadgeState,
  to: BadgeState,
  actor: { id: string; label: string },
): Promise<MoveResult | null> {
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.attendee.updateMany({
      where: { id: attendeeId, editionId, badgeNumber: { not: null }, badgeState: from },
      // A badge that moves again is back in its counter's hands, label or not.
      data: { badgeState: to, badgeStateVersion: { increment: 1 }, badgeStateAt: new Date(), labelDeliveredAt: null },
    });
    if (moved.count === 1) {
      await tx.badgeTransition.create({
        data: { attendeeId, fromState: from, toState: to, userId: actor.id, userLabel: actor.label },
      });
    }
    const row = await tx.attendee.findFirst({
      where: { id: attendeeId, editionId, badgeNumber: { not: null } },
      select: LIVE_BADGE_SELECT,
    });
    return row && { applied: moved.count === 1, badge: toLiveBadge(row) };
  });
  // After the commit: a screen must never see a move that could still roll back.
  if (result?.applied) publishArrivals(editionId, { type: "badge", data: result.badge });
  return result;
}
