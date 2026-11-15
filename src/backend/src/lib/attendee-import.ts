import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { BILLETWEB_API, getBilletwebParams } from "./billetweb.js";
import { parseWallTime } from "./zoned-time.js";
import { publishArrivals } from "./arrivals-stream.js";
import { LIVE_BADGE_SELECT, loadWithdrawals, toLiveBadge } from "./badge-state.js";

// Importing an edition's attendees from its Billetweb event (RG-ARR-12, #638),
// by hand from the admin or every five minutes while the stations are open
// (#800). One call to Billetweb per import; after the first, only what
// changed since the last one.

// Billetweb's `last_update` is a wall-clock time we cannot compare to ours to the
// second: the incremental import goes back this far before the last one.
const SYNC_OVERLAP_SECONDS = 10 * 60;

// Billetweb's ticket form has no fixed "company" field: each organiser names it.
const COMPANY_FIELD = /entreprise|soci[eé]t[eé]|company|organi[sz]ation|employeur/i;

/** Who the history names for a ticket checked in by Billetweb's own scan app (#800). */
export const EXTERNAL_SCAN_LABEL = "Billetweb Scan";

// The fields of an Attendee that Billetweb owns — all of them.
export interface ImportedAttendee {
  billetwebId: string;
  barcode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  billetwebTicketId: string;
  category: string | null;
  orderId: string;
  orderDate: Date;
  isCancelled: boolean;
}

/** A check-in Billetweb holds (`used`), made by us or by its own app (#800). */
export interface BilletwebCheckIn {
  at: Date;
  lane: string | null;
}

type ExistingAttendee = ImportedAttendee & { id: number; ticketTierId: number | null };

export interface AttendeeImportPlan {
  creates: Array<ImportedAttendee & { ticketTierId: number | null }>;
  updates: Array<{ id: number; data: Prisma.AttendeeUncheckedUpdateInput }>;
  cancelled: number;
  unchanged: number;
}

function pickCompany(...fields: unknown[]): string | null {
  for (const custom of fields) {
    if (!custom || typeof custom !== "object") continue;
    for (const [name, value] of Object.entries(custom)) {
      if (COMPANY_FIELD.test(name) && String(value ?? "").trim()) return String(value).trim();
    }
  }
  return null;
}

/** One row of Billetweb's /event/:id/attendees, or null when it cannot be keyed. */
export function toImportedAttendee(row: Record<string, unknown>): ImportedAttendee | null {
  const billetwebId = String(row.id ?? "");
  // Paris wall time, written "2026-09-01 10:00:00" by Billetweb.
  const orderDate = parseWallTime(String(row.order_date ?? "").replace(" ", "T"));
  if (!billetwebId || !orderDate) return null;
  const text = (value: unknown) => String(value ?? "").trim() || null;
  return {
    billetwebId,
    barcode: String(row.barcode ?? ""),
    firstName: String(row.firstname ?? "").trim(),
    lastName: String(row.name ?? "").trim(),
    email: text(row.email),
    company: pickCompany(row.custom, row.custom_order),
    billetwebTicketId: String(row.ticket_id ?? ""),
    category: text(row.category),
    orderId: String(row.order_id ?? ""),
    orderDate,
    // "1" refunded or cancelled, "2" order deleted: undocumented, seen on the
    // test event (2026-10-28). Anything but "0" keeps the ticket out of the arrivals.
    isCancelled: String(row.disabled ?? "0") !== "0",
  };
}

/**
 * The check-in a row carries: `used` "1", `used_date` in Paris wall time and
 * `lane`, as measured on the test event (2026-11-04). Null when not checked in.
 */
export function checkInOf(row: Record<string, unknown>): BilletwebCheckIn | null {
  if (String(row.used ?? "0") !== "1") return null;
  const at = parseWallTime(String(row.used_date ?? "").replace(" ", "T"));
  if (!at) return null;
  return { at, lane: String(row.lane ?? "").trim() || null };
}

const COMPARED_FIELDS = [
  "barcode", "firstName", "lastName", "email", "company", "billetwebTicketId", "category", "orderId", "isCancelled",
] as const;

/**
 * What an import writes: new tickets created, known ones updated only where a
 * field moved, so a second import with nothing new on Billetweb writes nothing.
 */
export function planAttendeeImport(
  existing: ExistingAttendee[],
  imported: ImportedAttendee[],
  tierIdByTicket: Map<string, number>,
): AttendeeImportPlan {
  const byBilletwebId = new Map(existing.map((a) => [a.billetwebId, a]));
  const plan: AttendeeImportPlan = { creates: [], updates: [], cancelled: 0, unchanged: 0 };

  for (const row of imported) {
    const ticketTierId = tierIdByTicket.get(row.billetwebTicketId) ?? null;
    const current = byBilletwebId.get(row.billetwebId);
    if (!current) {
      plan.creates.push({ ...row, ticketTierId });
      continue;
    }
    const data: Prisma.AttendeeUncheckedUpdateInput = {};
    for (const field of COMPARED_FIELDS) {
      if (current[field] !== row[field]) Object.assign(data, { [field]: row[field] });
    }
    if (current.orderDate.getTime() !== row.orderDate.getTime()) data.orderDate = row.orderDate;
    if (current.ticketTierId !== ticketTierId) data.ticketTierId = ticketTierId;
    if (Object.keys(data).length === 0) {
      plan.unchanged++;
      continue;
    }
    if (row.isCancelled && !current.isCancelled) plan.cancelled++;
    plan.updates.push({ id: current.id, data });
  }
  return plan;
}

export interface AttendeeImportReport {
  isIncremental: boolean;
  received: number;
  created: number;
  updated: number;
  cancelled: number;
  unchanged: number;
  withoutTier: number;
  /** Tickets found checked in by Billetweb's own app, now marked scanned here (#800). */
  externalCheckIns: number;
}

export type AttendeeImportRefusal =
  | "not_found"
  | "edition_not_linked"
  | "attendees_purged"
  | "credentials_missing"
  | "import_running"
  | "billetweb_error";

// One import at a time per edition: Billetweb allows 10 calls a minute on
// /attendees, and two clicks (or a click and the timer) must not race on the same rows.
const runningImports = new Set<number>();

/**
 * Import the edition's attendees from its Billetweb event. The outcome, good
 * or bad, is written on the edition (`attendeesSyncedAt`, `attendeesSyncError`)
 * for the admin to see, whoever started it.
 */
export async function importAttendees(
  editionId: number,
  log?: { warn: (obj: object, msg: string) => void },
): Promise<{ ok: true; report: AttendeeImportReport } | { ok: false; reason: AttendeeImportRefusal }> {
  const edition = await prisma.edition.findFirst({
    where: { id: editionId, deletedAt: null },
    select: { billetwebEventId: true, attendeesSyncedAt: true, attendeesPurgedAt: true },
  });
  if (!edition) return { ok: false, reason: "not_found" };
  if (!edition.billetwebEventId) return { ok: false, reason: "edition_not_linked" };
  // Deleted at the end of their retention (RG-ARR-66): never fetched again.
  if (edition.attendeesPurgedAt) return { ok: false, reason: "attendees_purged" };
  const params = getBilletwebParams();
  if (!params) return { ok: false, reason: "credentials_missing" };
  if (runningImports.has(editionId)) return { ok: false, reason: "import_running" };

  runningImports.add(editionId);
  try {
    const startedAt = new Date();
    // disabled=1: refunded and cancelled tickets too, so they get marked.
    params.set("disabled", "1");
    if (edition.attendeesSyncedAt) {
      const since = Math.floor(edition.attendeesSyncedAt.getTime() / 1000) - SYNC_OVERLAP_SECONDS;
      params.set("last_update", String(since));
    }
    const res = await fetch(
      `${BILLETWEB_API}/event/${encodeURIComponent(edition.billetwebEventId)}/attendees?${params}`,
    ).catch(() => null);
    const body = (await res?.json().catch(() => null)) as unknown;
    // Billetweb reports most errors (rights, rate limit) as a 200 with an `error`.
    if (!res?.ok || !Array.isArray(body)) {
      log?.warn({ editionId, status: res?.status ?? 0, body }, "Billetweb attendees import failed");
      const reason =
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : res
            ? `HTTP ${res.status}`
            : "network";
      await prisma.edition.update({ where: { id: editionId }, data: { attendeesSyncError: reason.slice(0, 200) } });
      return { ok: false, reason: "billetweb_error" };
    }

    const rows = body as Array<Record<string, unknown>>;
    const imported = rows.map(toImportedAttendee).filter((a): a is ImportedAttendee => a !== null);

    const [existing, tiers] = await Promise.all([
      prisma.attendee.findMany({
        where: { editionId, billetwebId: { in: imported.map((a) => a.billetwebId) } },
      }),
      // Trashed tiers too: a ticket still points to its tier once it is binned.
      prisma.ticketTier.findMany({
        where: { editionId, billetwebTicketId: { not: null } },
        select: { id: true, billetwebTicketId: true },
      }),
    ]);
    const tierIdByTicket = new Map(tiers.map((t) => [t.billetwebTicketId as string, t.id]));
    const plan = planAttendeeImport(existing, imported, tierIdByTicket);

    await prisma.$transaction([
      prisma.attendee.createMany({ data: plan.creates.map((a) => ({ ...a, editionId })) }),
      ...plan.updates.map((u) => prisma.attendee.update({ where: { id: u.id }, data: u.data })),
      // A ticket imported before its tier stays unlinked: the incremental
      // import will not bring it back, so each import catches up here.
      ...tiers.map((t) =>
        prisma.attendee.updateMany({
          where: { editionId, ticketTierId: null, billetwebTicketId: t.billetwebTicketId as string },
          data: { ticketTierId: t.id },
        }),
      ),
      prisma.edition.update({ where: { id: editionId }, data: { attendeesSyncedAt: startedAt, attendeesSyncError: null } }),
    ]);

    const externalCheckIns = await recordExternalCheckIns(editionId, rows);
    await publishChanges(editionId, plan);

    const withoutTier = await prisma.attendee.count({ where: { editionId, ticketTierId: null } });
    return {
      ok: true,
      report: {
        isIncremental: edition.attendeesSyncedAt !== null,
        received: imported.length,
        created: plan.creates.length,
        updated: plan.updates.length,
        cancelled: plan.cancelled,
        unchanged: plan.unchanged,
        withoutTier,
        externalCheckIns,
      },
    };
  } finally {
    runningImports.delete(editionId);
  }
}

/**
 * A ticket Billetweb holds as checked in that we never scanned nor checked in
 * was let in by Billetweb's own app (#800): marked scanned at its time, so our
 * entrance says "already scanned". Its badge is not moved: the card would
 * reach the counter minutes after the person, who may have their badge
 * already. A ticket we checked in ourselves, or whose check-in we are taking
 * back (#797), has `checkedInAt` set and is left alone.
 */
async function recordExternalCheckIns(editionId: number, rows: Array<Record<string, unknown>>): Promise<number> {
  let count = 0;
  for (const row of rows) {
    const checkIn = checkInOf(row);
    if (!checkIn) continue;
    const marked = await prisma.attendee.updateMany({
      where: { editionId, billetwebId: String(row.id), scannedAt: null, checkedInAt: null, isCancelled: false },
      data: {
        scannedAt: checkIn.at,
        scannedByLabel: checkIn.lane ? `${EXTERNAL_SCAN_LABEL} (${checkIn.lane})` : EXTERNAL_SCAN_LABEL,
        checkedInAt: checkIn.at,
      },
    });
    count += marked.count;
  }
  if (count > 0) publishArrivals(editionId, { type: "counts", data: null });
  return count;
}

/**
 * The screens learn what the import changed on a badge they show: a refund
 * flags its card and puts it on the help desk's list of badges to take back
 * (#800). Only refunds and their reversal matter here; new tickets have no
 * card until they are scanned.
 */
async function publishChanges(editionId: number, plan: AttendeeImportPlan): Promise<void> {
  const ids = plan.updates.filter((u) => "isCancelled" in u.data).map((u) => u.id);
  if (ids.length === 0) return;
  // The screens keep a badge's highest version: the flag must come with a new one.
  await prisma.attendee.updateMany({
    where: { id: { in: ids }, badgeNumber: { not: null } },
    data: { badgeStateVersion: { increment: 1 } },
  });
  const badges = await prisma.attendee.findMany({
    where: { id: { in: ids }, badgeNumber: { not: null } },
    select: LIVE_BADGE_SELECT,
  });
  for (const badge of badges) publishArrivals(editionId, { type: "badge", data: toLiveBadge(badge) });
  publishArrivals(editionId, { type: "withdrawals", data: await loadWithdrawals(editionId) });
  publishArrivals(editionId, { type: "counts", data: null });
}

/** Whether an import is in flight: what a test waits on. */
export const isImportRunning = (editionId: number) => runningImports.has(editionId);
