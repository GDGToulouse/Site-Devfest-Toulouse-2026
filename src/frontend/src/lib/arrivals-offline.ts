// The Scan phone's own answer when the backend is gone (RG-ARR-64, #642): a
// table of code digests → badge number, fetched while online and kept in the
// browser. It holds no name and no code (RG-ARR-65): a digest cut to a few
// hex digits, computed like the backend's (lib/arrivals-scan.ts).

export interface OfflineTable {
  editionId: number;
  keyLength: number;
  /** When the phone erases it: the day after the event. */
  expiresAt: string | null;
  entries: Record<string, number>;
}

// In the table: a badge number, or one of these (backend: OFFLINE_DEDICATED, OFFLINE_AMBIGUOUS).
const DEDICATED = 0;
const AMBIGUOUS = -1;

// `key` is the code's digest: what the scan is queued under, never the code (#645).
export type OfflineAnswer =
  | { kind: "badge"; number: number; key: string }
  | { kind: "dedicated"; key: string }
  | { kind: "ambiguous" }
  | { kind: "unknown" };

const storageKey = (editionId: number) => `devfest-arrivals-offline-${editionId}`;

export function storeOfflineTable(table: OfflineTable): void {
  try {
    window.localStorage.setItem(storageKey(table.editionId), JSON.stringify(table));
  } catch {
    // Storage full or blocked: the phone keeps working online, and says so
    // when the backend goes (no table, no degraded answer).
  }
}

/** The table kept for this edition, or null; past its date it is erased on the spot. */
export function loadOfflineTable(editionId: number, now = Date.now()): OfflineTable | null {
  try {
    const raw = window.localStorage.getItem(storageKey(editionId));
    if (!raw) return null;
    const table = JSON.parse(raw) as OfflineTable;
    if (table.expiresAt && Date.parse(table.expiresAt) <= now) {
      window.localStorage.removeItem(storageKey(editionId));
      return null;
    }
    return table;
  } catch {
    return null;
  }
}

export async function offlineKey(editionId: number, code: string, keyLength: number): Promise<string> {
  const bytes = new TextEncoder().encode(`devfest-arrivals:${editionId}:${code.trim()}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, keyLength);
}

export async function lookupOffline(table: OfflineTable, code: string): Promise<OfflineAnswer> {
  const key = await offlineKey(table.editionId, code, table.keyLength);
  const value = table.entries[key];
  if (value === undefined) return { kind: "unknown" };
  if (value === DEDICATED) return { kind: "dedicated", key };
  if (value === AMBIGUOUS) return { kind: "ambiguous" };
  return { kind: "badge", number: value, key };
}

// The scans made in degraded mode, sent once the backend is back (RG-ARR-67,
// #645). Same rule as the table (RG-ARR-65): a digest and the number shown,
// no name, no code. Emptied as the backend takes them.

export interface QueuedScan {
  /** The phone's own id: the backend answers per scan. */
  id: string;
  key: string;
  /** The number shown, or 0 for the dedicated flow. */
  number: number;
  scannedAt: string;
}

const queueKey = (editionId: number) => `devfest-arrivals-offline-queue-${editionId}`;

export function loadOfflineQueue(editionId: number): QueuedScan[] {
  try {
    return JSON.parse(window.localStorage.getItem(queueKey(editionId)) ?? "[]") as QueuedScan[];
  } catch {
    return [];
  }
}

function storeOfflineQueue(editionId: number, queue: QueuedScan[]): void {
  try {
    if (queue.length > 0) window.localStorage.setItem(queueKey(editionId), JSON.stringify(queue));
    else window.localStorage.removeItem(queueKey(editionId));
  } catch {
    // Storage blocked: the scan still answered; only its record is lost.
  }
}

/**
 * Keep a degraded-mode answer to send later. The same ticket read twice
 * during the outage is kept once, at its first reading. Returns the queue.
 */
export function queueOfflineScan(
  editionId: number,
  answer: OfflineAnswer,
  now = new Date(),
): QueuedScan[] {
  const queue = loadOfflineQueue(editionId);
  if (answer.kind !== "badge" && answer.kind !== "dedicated") return queue;
  const number = answer.kind === "badge" ? answer.number : DEDICATED;
  if (queue.some((scan) => scan.key === answer.key && scan.number === number)) return queue;
  const next = [...queue, { id: crypto.randomUUID(), key: answer.key, number, scannedAt: now.toISOString() }];
  storeOfflineQueue(editionId, next);
  return next;
}

/** Drop the scans the backend answered for. Returns what is left. */
export function dropFromOfflineQueue(editionId: number, ids: string[]): QueuedScan[] {
  const answered = new Set(ids);
  const left = loadOfflineQueue(editionId).filter((scan) => !answered.has(scan.id));
  storeOfflineQueue(editionId, left);
  return left;
}
