import { prisma } from "./prisma.js";
import { BADGE_NUMBER_QUERY, fold } from "./arrivals-scan.js";
import { EXTERNAL_SCAN_LABEL } from "./attendee-import.js";
import type { BadgeState, Prisma } from "../generated/prisma/client.js";

// Every attendee of an edition and where their arrival stands (#806): the team
// answers "has X arrived?" and spots what is stuck, a check-in Billetweb never
// acknowledged, a refunded badge still out. Read-only: every move stays on the
// stations. Never the e-mail.

/** Where the ticket stands on Billetweb, as far as the site knows. */
export type BilletwebCheckIn =
  /** Not scanned, nothing to send. */
  | "none"
  /** Scanned here, check-in acknowledged. */
  | "confirmed"
  /** Scanned here, check-in not acknowledged yet: the minute job retries. */
  | "pending"
  /** The last attempt failed: the job retries, the error says why. */
  | "error"
  /** Checked in by Billetweb's own app, read at import (#800). */
  | "external"
  /** Scan undone here, check-in not taken back yet (#797). */
  | "undo_pending";

export const ATTENDEE_FILTERS = ["not_scanned", "waiting", "delivered", "checkin_issue", "cancelled"] as const;
export type AttendeeFilter = (typeof ATTENDEE_FILTERS)[number];

export interface AttendeeListItem {
  id: number;
  firstName: string;
  lastName: string;
  company: string | null;
  tierName: string | null;
  isOutsideFlow: boolean;
  badgeNumber: number | null;
  badgeState: BadgeState;
  labelDelivered: boolean;
  isCancelled: boolean;
  isWithdrawn: boolean;
  scannedAt: Date | null;
  scannedBy: string | null;
  scannedOffline: boolean;
  billetweb: BilletwebCheckIn;
  checkInError: string | null;
}

export interface AttendeePage {
  page: number;
  limit: number;
  total: number;
  items: AttendeeListItem[];
}

const LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  category: true,
  ticketTier: { select: { nameFr: true, isOutsideFlow: true } },
  badgeNumber: true,
  badgeState: true,
  labelDeliveredAt: true,
  isCancelled: true,
  badgeWithdrawnAt: true,
  scannedAt: true,
  scannedByLabel: true,
  scannedOffline: true,
  checkedInAt: true,
  checkInError: true,
} satisfies Prisma.AttendeeSelect;

type ListRow = Prisma.AttendeeGetPayload<{ select: typeof LIST_SELECT }>;

export function billetwebCheckIn(row: {
  scannedAt: Date | null;
  scannedByLabel: string | null;
  checkedInAt: Date | null;
  checkInError: string | null;
}): BilletwebCheckIn {
  if (!row.scannedAt) return row.checkedInAt ? "undo_pending" : "none";
  if (row.scannedByLabel?.startsWith(EXTERNAL_SCAN_LABEL)) return "external";
  if (row.checkedInAt) return "confirmed";
  return row.checkInError ? "error" : "pending";
}

// The filters read the same columns as the stations: "waiting" is a ticket
// scanned whose badge is still to hand over, so never the dedicated flow, met
// by its own reception with no badge from a counter.
const FILTER_WHERE: Record<AttendeeFilter, Prisma.AttendeeWhereInput> = {
  not_scanned: { scannedAt: null, isCancelled: false },
  waiting: {
    scannedAt: { not: null },
    badgeState: { in: ["PRINTED", "TO_FETCH", "READY"] },
    isCancelled: false,
    NOT: { ticketTier: { is: { isOutsideFlow: true } } },
  },
  delivered: { badgeState: "DELIVERED" },
  checkin_issue: {
    OR: [
      { scannedAt: { not: null }, checkedInAt: null },
      { scannedAt: null, checkedInAt: { not: null } },
    ],
  },
  cancelled: { isCancelled: true },
};

function toItem(row: ListRow): AttendeeListItem {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    tierName: row.ticketTier?.nameFr ?? row.category,
    isOutsideFlow: row.ticketTier?.isOutsideFlow ?? false,
    badgeNumber: row.badgeNumber,
    badgeState: row.badgeState,
    labelDelivered: row.labelDeliveredAt !== null,
    isCancelled: row.isCancelled,
    isWithdrawn: row.badgeWithdrawnAt !== null,
    scannedAt: row.scannedAt,
    scannedBy: row.scannedByLabel,
    scannedOffline: row.scannedOffline,
    billetweb: billetwebCheckIn(row),
    checkInError: row.checkInError,
  };
}

/**
 * One page of the edition's attendees, by last then first name. The search
 * matches a badge number (`2147` or `2 1 47`), or every word typed starting a
 * word of the name or the company, accents folded: read and filtered here, as
 * the stations' search does, on rows bounded by the edition's tickets.
 */
export async function listAttendees(
  editionId: number,
  { search, filter, page, limit }: { search?: string; filter?: AttendeeFilter; page: number; limit: number },
): Promise<AttendeePage> {
  const where: Prisma.AttendeeWhereInput = { editionId, ...(filter && FILTER_WHERE[filter]) };
  const query = search?.trim() ?? "";
  const digits = query.replace(/\s+/g, "");
  if (BADGE_NUMBER_QUERY.test(digits)) where.badgeNumber = Number(digits);

  const rows = await prisma.attendee.findMany({
    where,
    select: LIST_SELECT,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
  });

  const words = BADGE_NUMBER_QUERY.test(digits) ? [] : fold(query).split(/[\s'-]+/).filter((w) => w.length > 0);
  const matching =
    words.length === 0
      ? rows
      : rows.filter((row) => {
          const textWords = fold(`${row.firstName} ${row.lastName} ${row.company ?? ""}`).split(/[\s'-]+/);
          return words.every((w) => textWords.some((t) => t.startsWith(w)));
        });

  return {
    page,
    limit,
    total: matching.length,
    items: matching.slice((page - 1) * limit, page * limit).map(toItem),
  };
}
