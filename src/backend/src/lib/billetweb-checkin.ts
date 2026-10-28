import type { FastifyBaseLogger } from "fastify";

import { prisma } from "./prisma.js";
import { BILLETWEB_API, getBilletwebParams } from "./billetweb.js";

// Checking scanned tickets in on Billetweb (RG-ARR-37, #642). Never on the
// scan's path: the entrance must not wait on Billetweb, nor stop when it is
// down. A scan asks for a run; a minute job retries what is left.
//
// Measured on the test event (2026-10-28): /check answers the tickets it
// acknowledged as [{ product_id, state: "1" }] and leaves an unknown id out
// without an error; `used_date_unix` is ignored, Billetweb keeps the time of
// the call. A retried check-in therefore carries the retry's time.

/** Tickets per /check call: one call small enough to fail alone. */
const CHECK_IN_BATCH_SIZE = 100;

/** Pending tickets one run takes on: well above a morning's arrivals per minute. */
const CHECK_IN_RUN_LIMIT = 1_000;

const running = new Set<number>();
const rerunRequested = new Set<number>();

// The lane Billetweb shows: the volunteer's name, never a whole address. An
// invited volunteer's name is their email until they change it.
function laneOf(label: string | null): string {
  if (!label) return "Accueil";
  return label.includes("@") ? label.split("@")[0] : label;
}

export interface CheckInReport {
  sent: number;
  acknowledged: number;
  failed: number;
}

/** Send every scanned ticket of the edition that Billetweb has not acknowledged yet. */
export async function checkInPending(editionId: number, log?: Pick<FastifyBaseLogger, "warn">): Promise<CheckInReport> {
  const report: CheckInReport = { sent: 0, acknowledged: 0, failed: 0 };
  const params = getBilletwebParams();
  const edition = await prisma.edition.findUnique({ where: { id: editionId }, select: { billetwebEventId: true } });
  // Without credentials or an event, the tickets simply stay pending.
  if (!params || !edition?.billetwebEventId) return report;

  const pending = await prisma.attendee.findMany({
    where: { editionId, scannedAt: { not: null }, checkedInAt: null, isCancelled: false },
    select: { id: true, billetwebId: true, scannedByLabel: true },
    orderBy: { scannedAt: "asc" },
    take: CHECK_IN_RUN_LIMIT,
  });
  const url = `${BILLETWEB_API}/event/${edition.billetwebEventId}/check?${params}`;

  for (let i = 0; i < pending.length; i += CHECK_IN_BATCH_SIZE) {
    const batch = pending.slice(i, i + CHECK_IN_BATCH_SIZE);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: batch.map((a) => ({ id: Number(a.billetwebId), used: 1, lane: laneOf(a.scannedByLabel) })),
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as unknown;
    const acknowledged = new Set(
      Array.isArray(body)
        ? body
            .filter((entry: { product_id?: unknown; state?: unknown }) => String(entry?.state) === "1")
            .map((entry: { product_id?: unknown }) => String(entry.product_id))
        : [],
    );
    const ok = batch.filter((a) => acknowledged.has(a.billetwebId));
    const ko = batch.filter((a) => !acknowledged.has(a.billetwebId));
    report.sent += batch.length;
    report.acknowledged += ok.length;
    report.failed += ko.length;
    if (ok.length > 0) {
      await prisma.attendee.updateMany({
        where: { id: { in: ok.map((a) => a.id) } },
        data: { checkedInAt: new Date(), checkInError: null },
      });
    }
    if (ko.length > 0) {
      // Billetweb puts most of its errors in a 200 (integration.md).
      const reason = (
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : res
            ? `HTTP ${res.status}, not acknowledged`
            : "network"
      ).slice(0, 200);
      log?.warn({ editionId, failed: ko.length, reason }, "Billetweb check-in failed");
      await prisma.attendee.updateMany({
        where: { id: { in: ko.map((a) => a.id) } },
        data: { checkInError: reason },
      });
    }
  }
  return report;
}

/**
 * Ask for a check-in run, without waiting for it. One run at a time per
 * edition; a request during a run starts another right after, so a scan made
 * while a batch is in flight is not left for the minute job.
 */
export function requestCheckIn(editionId: number, log: Pick<FastifyBaseLogger, "warn" | "error">): void {
  if (running.has(editionId)) {
    rerunRequested.add(editionId);
    return;
  }
  running.add(editionId);
  void (async () => {
    try {
      do {
        rerunRequested.delete(editionId);
        await checkInPending(editionId, log);
      } while (rerunRequested.has(editionId));
    } catch (err) {
      log.error({ err, editionId }, "Billetweb check-in crashed");
    } finally {
      running.delete(editionId);
    }
  })();
}

/** The editions with tickets left to check in: what the minute job retries. */
export async function editionsWithPendingCheckIns(): Promise<number[]> {
  const rows = await prisma.attendee.findMany({
    where: { scannedAt: { not: null }, checkedInAt: null, isCancelled: false },
    select: { editionId: true },
    distinct: ["editionId"],
  });
  return rows.map((r) => r.editionId);
}

/** Whether a run is in flight: what a test waits on. */
export function isCheckInRunning(editionId: number): boolean {
  return running.has(editionId);
}
