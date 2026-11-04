import QRCode from "qrcode";

import { prisma } from "./prisma.js";
import { publishArrivals } from "./arrivals-stream.js";
import { HELP_ENTRY_SELECT, LIVE_BADGE_SELECT, toHelpEntry, toLiveBadge } from "./badge-state.js";
import { readBadgeDesign } from "./badge-design.js";
import { badgeVCard } from "./badge-pdf.js";

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

/** What the label prints: the text, and the badge's QR code when there is a ticket (#801). */
export interface PrintedLabel extends LabelText {
  /** SVG, black: the Zebra prints in one colour. Null for a label without a ticket. */
  qrSvg: string | null;
}

// The same content as the edition's badges (RG-ARR-51): the ticket's code,
// which the entrance and the sponsors' app read, or a contact card of what
// the label prints.
async function qrSvgOf(editionId: number, barcode: string, text: LabelText): Promise<string> {
  const edition = await prisma.edition.findUnique({ where: { id: editionId }, select: { badgeDesign: true } });
  const content = readBadgeDesign(edition?.badgeDesign).qrContent === "VCARD" ? badgeVCard(text) : barcode;
  return QRCode.toString(content, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}

/** Why the help desk may not label this ticket: it is not theirs to badge. */
export type LabelRefusal = "cancelled" | "dedicated" | "not_printed";

type Actor = { id: string | null; label: string };

const LABEL_ROW_SELECT = {
  id: true,
  barcode: true,
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

/**
 * Record one print (RG-ARR-54) and give what goes on the label; null for no
 * such ticket. `text` is what the desk corrected (#801): a ticket handed to a
 * colleague, a typo. The ticket itself is left as Billetweb has it.
 */
export async function printLabel(
  editionId: number,
  attendeeId: number,
  actor: Actor,
  text?: LabelText,
): Promise<{ label: PrintedLabel; printCount: number } | { refused: LabelRefusal } | null> {
  const row = await prisma.attendee.findFirst({ where: { id: attendeeId, editionId }, select: LABEL_ROW_SELECT });
  if (!row) return null;
  const refused = refusalOf(row);
  if (refused) return { refused };

  const printed = text ?? { firstName: row.firstName, lastName: row.lastName, company: row.company };
  await prisma.badgeLabel.create({
    data: { editionId, attendeeId, ...printed, userId: actor.id, userLabel: actor.label },
  });
  publishArrivals(editionId, { type: "counts", data: null });
  const printCount = await prisma.badgeLabel.count({ where: { attendeeId } });
  return { label: { ...printed, qrSvg: await qrSvgOf(editionId, row.barcode, printed) }, printCount };
}

/**
 * A label for a person with no ticket (#801): a contractor, a guest added at
 * the last minute. Typed at the desk, all three lines required; no QR code,
 * nothing on Billetweb, no badge to move. Counted apart on the tracking screen.
 */
export async function printFreeLabel(editionId: number, actor: Actor, text: LabelText): Promise<{ label: PrintedLabel }> {
  await prisma.badgeLabel.create({ data: { editionId, ...text, userId: actor.id, userLabel: actor.label } });
  publishArrivals(editionId, { type: "counts", data: null });
  return { label: { ...text, qrSvg: null } };
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
