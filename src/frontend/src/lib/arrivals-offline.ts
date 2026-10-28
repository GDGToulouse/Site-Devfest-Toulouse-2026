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

export type OfflineAnswer =
  | { kind: "badge"; number: number }
  | { kind: "dedicated" }
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
  const value = table.entries[await offlineKey(table.editionId, code, table.keyLength)];
  if (value === undefined) return { kind: "unknown" };
  if (value === DEDICATED) return { kind: "dedicated" };
  if (value === AMBIGUOUS) return { kind: "ambiguous" };
  return { kind: "badge", number: value };
}
