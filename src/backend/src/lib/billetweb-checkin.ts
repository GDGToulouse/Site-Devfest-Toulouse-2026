import type { FastifyBaseLogger } from "fastify";

import { prisma } from "./prisma.js";
import { BILLETWEB_API, getBilletwebParams } from "./billetweb.js";

// Checking scanned tickets in on Billetweb (RG-ARR-37, #642). Never on the
// scan's path: the entrance must not wait on Billetweb, nor stop when it is
// down. A scan asks for a run; a minute job retries what is left.
//
// Measured on the test event (2026-10-28, 2026-11-04): /check answers the
// tickets it took as [{ product_id, state }], `state` being the `used` sent
// ("0" when a check-in is taken back), and leaves an unknown id out without an
// error; `used_date_unix` is ignored, Billetweb keeps the time of the call. A
// retried check-in therefore carries the retry's time. Taking one back keeps
// `used_date` and `lane`, and moves the ticket's `last_update`.

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

/**
 * Send every scanned ticket of the edition that Billetweb has not acknowledged
 * yet, then take back every ticket whose scan was cancelled after it was
 * checked in (#797): `scannedAt` gone, `checkedInAt` still set.
 */
export async function checkInPending(editionId: number, log?: Pick<FastifyBaseLogger, "warn">): Promise<CheckInReport> {
  const report: CheckInReport = { sent: 0, acknowledged: 0, failed: 0 };
  const params = getBilletwebParams();
  const edition = await prisma.edition.findUnique({ where: { id: editionId }, select: { billetwebEventId: true } });
  // Without credentials or an event, the tickets simply stay pending.
  if (!params || !edition?.billetwebEventId) return report;
  const url = `${BILLETWEB_API}/event/${edition.billetwebEventId}/check?${params}`;

  const pending = await prisma.attendee.findMany({
    where: { editionId, scannedAt: { not: null }, checkedInAt: null, isCancelled: false },
    select: { id: true, billetwebId: true, scannedByLabel: true },
    orderBy: { scannedAt: "asc" },
    take: CHECK_IN_RUN_LIMIT,
  });
  await sendChecks(url, pending, (a) => ({ id: Number(a.billetwebId), used: 1, lane: laneOf(a.scannedByLabel) }), {
    report,
    log: (failed, reason) => log?.warn({ editionId, failed, reason }, "Billetweb check-in failed"),
    acknowledged: { checkedInAt: new Date(), checkInError: null },
  });

  const cancelled = await prisma.attendee.findMany({
    where: { editionId, scannedAt: null, checkedInAt: { not: null } },
    select: { id: true, billetwebId: true },
    take: CHECK_IN_RUN_LIMIT,
  });
  // Even if scanned again meanwhile: Billetweb no longer has it checked in, so
  // the first pass of the next run checks it in anew.
  await sendChecks(url, cancelled, (a) => ({ id: Number(a.billetwebId), used: 0 }), {
    report,
    log: (failed, reason) => log?.warn({ editionId, failed, reason }, "Billetweb check-in undo failed"),
    acknowledged: { checkedInAt: null, checkInError: null },
  });
  return report;
}

/**
 * One kind of /check call over a list of tickets, in batches; each answer
 * written back. Billetweb answers each ticket it took with its new `used`
 * as `state`: "1" for a check-in, "0" for one taken back.
 */
async function sendChecks<T extends { id: number; billetwebId: string }>(
  url: string,
  tickets: T[],
  entry: (ticket: T) => { id: number; used: 0 | 1; lane?: string },
  { report, log, acknowledged: onAcknowledged }: {
    report: CheckInReport;
    log: (failed: number, reason: string) => void;
    acknowledged: { checkedInAt: Date | null; checkInError: null };
  },
): Promise<void> {
  for (let i = 0; i < tickets.length; i += CHECK_IN_BATCH_SIZE) {
    const batch = tickets.slice(i, i + CHECK_IN_BATCH_SIZE);
    const sent = batch.map(entry);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: sent }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as unknown;
    const expected = new Map(sent.map((s) => [String(s.id), String(s.used)]));
    const acknowledged = new Set(
      Array.isArray(body)
        ? body
            .filter((answer: { product_id?: unknown; state?: unknown }) => expected.get(String(answer?.product_id)) === String(answer?.state))
            .map((answer: { product_id?: unknown }) => String(answer.product_id))
        : [],
    );
    const ok = batch.filter((a) => acknowledged.has(a.billetwebId));
    const ko = batch.filter((a) => !acknowledged.has(a.billetwebId));
    report.sent += batch.length;
    report.acknowledged += ok.length;
    report.failed += ko.length;
    if (ok.length > 0) {
      await prisma.attendee.updateMany({ where: { id: { in: ok.map((a) => a.id) } }, data: onAcknowledged });
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
      log(ko.length, reason);
      await prisma.attendee.updateMany({
        where: { id: { in: ko.map((a) => a.id) } },
        data: { checkInError: reason },
      });
    }
  }
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

/** The editions with tickets left to check in, or to take back: what the minute job retries. */
export async function editionsWithPendingCheckIns(): Promise<number[]> {
  const rows = await prisma.attendee.findMany({
    where: {
      OR: [
        { scannedAt: { not: null }, checkedInAt: null, isCancelled: false },
        { scannedAt: null, checkedInAt: { not: null } },
      ],
    },
    select: { editionId: true },
    distinct: ["editionId"],
  });
  return rows.map((r) => r.editionId);
}

/** Whether a run is in flight: what a test waits on. */
export function isCheckInRunning(editionId: number): boolean {
  return running.has(editionId);
}
