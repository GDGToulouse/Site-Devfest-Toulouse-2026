import { prisma } from "./prisma.js";
import { publishArrivals } from "./arrivals-stream.js";
import { HELP_ENTRY_SELECT, LIVE_BADGE_SELECT, toHelpEntry, toLiveBadge } from "./badge-state.js";

// The help desk (RG-ARR-50 to RG-ARR-54, #713): whoever left the normal path
// gets a label printed on the Zebra and stuck on a blank badge. Printing and
// handing over are two steps: a label can jam, and only the one handed over
// makes the person Distribué. The printing itself happens in the browser,
// through the printer's driver; the backend keeps the trace.

export interface LabelText {
  firstName: string;
  lastName: string;
  company: string | null;
}

/** Why the help desk may not label this ticket: it is not theirs to badge. */
export type LabelRefusal = "cancelled" | "dedicated" | "not_printed";

type Actor = { id: string; label: string };

const LABEL_ROW_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  isCancelled: true,
  ticketTier: { select: { isOutsideFlow: true } },
} as const;

function refusalOf(row: { isCancelled: boolean; ticketTier: { isOutsideFlow: boolean } | null }): LabelRefusal | null {
  if (row.isCancelled) return "cancelled";
  // The dedicated welcome has its own badges (RG-ARR-14).
  if (row.ticketTier?.isOutsideFlow) return "dedicated";
  return null;
}

/** Record one print (RG-ARR-54) and give what goes on the label; null for no such ticket. */
export async function printLabel(
  editionId: number,
  attendeeId: number,
  actor: Actor,
): Promise<{ label: LabelText; printCount: number } | { refused: LabelRefusal } | null> {
  const row = await prisma.attendee.findFirst({ where: { id: attendeeId, editionId }, select: LABEL_ROW_SELECT });
  if (!row) return null;
  const refused = refusalOf(row);
  if (refused) return { refused };

  await prisma.badgeLabel.create({ data: { attendeeId, userId: actor.id, userLabel: actor.label } });
  const printCount = await prisma.badgeLabel.count({ where: { attendeeId } });
  return { label: { firstName: row.firstName, lastName: row.lastName, company: row.company }, printCount };
}

/**
 * The label is in the person's hands (RG-ARR-52): Distribué, and off the
 * screens that were waiting for them, their counter's or the help desk's list.
 * A person who came straight to the help desk counts as arrived too, so
 * `isFirstScan` tells the caller to check the ticket in. Handing over twice
 * changes nothing.
 */
export async function deliverLabel(
  editionId: number,
  attendeeId: number,
  actor: Actor,
): Promise<{ isFirstScan: boolean } | { refused: LabelRefusal } | null> {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.attendee.findFirst({
      where: { id: attendeeId, editionId },
      select: {
        ...LABEL_ROW_SELECT,
        badgeNumber: true,
        badgeState: true,
        scannedAt: true,
        labelDeliveredAt: true,
        _count: { select: { badgeLabels: true } },
      },
    });
    if (!row) return null;
    const refused = refusalOf(row) ?? (row._count.badgeLabels === 0 ? "not_printed" : null);
    if (refused) return { refused };
    if (row.labelDeliveredAt) return { isFirstScan: false, isNumbered: row.badgeNumber !== null, changed: false };

    const now = new Date();
    const isFirstScan = row.scannedAt === null;
    await tx.attendee.update({
      where: { id: attendeeId },
      data: {
        labelDeliveredAt: now,
        ...(isFirstScan ? { scannedAt: now, scannedByLabel: actor.label } : {}),
        // Numbered: the screens keep the highest version, so the move must
        // carry a new one even when the counter had already delivered it.
        ...(row.badgeNumber !== null
          ? { badgeState: "DELIVERED", badgeStateVersion: { increment: 1 }, badgeStateAt: now }
          : {}),
      },
    });
    if (row.badgeNumber !== null && row.badgeState !== "DELIVERED") {
      await tx.badgeTransition.create({
        data: { attendeeId, fromState: row.badgeState, toState: "DELIVERED", userId: actor.id, userLabel: actor.label },
      });
    }
    return { isFirstScan, isNumbered: row.badgeNumber !== null, changed: true };
  });
  if (!result || "refused" in result) return result;

  // After the commit, as for every move (badge-state.ts).
  if (result.changed && result.isNumbered) {
    const badge = await prisma.attendee.findUnique({ where: { id: attendeeId }, select: LIVE_BADGE_SELECT });
    if (badge) publishArrivals(editionId, { type: "badge", data: toLiveBadge(badge) });
  } else if (result.changed) {
    const entry = await prisma.attendee.findUnique({ where: { id: attendeeId }, select: HELP_ENTRY_SELECT });
    if (entry) publishArrivals(editionId, { type: "help", data: toHelpEntry(entry) });
  }
  return { isFirstScan: result.isFirstScan };
}
