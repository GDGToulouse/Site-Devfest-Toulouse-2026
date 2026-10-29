// The station a device works as on event day (RG-ARR-25, #641): Scan, a
// counter (and optionally one of its bins), or Aide. Kept on the device, not
// the account: the counter's laptop reopens on its counter, whoever takes over
// (RG-ARR-45).

export type Station =
  | { kind: "scan" }
  | { kind: "counter"; counter: number; bin: number | null }
  | { kind: "help" };

const STORAGE_KEY = "devfest-arrivals-station";

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
// Bins count from 0 (RG-ARR-15): bin 0 is a bin, not "no bin".
const isBin = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** What the device remembers, or null: storage can be blocked, stale or hand-edited. */
export function readStation(): Station | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.kind === "scan" || value.kind === "help") return { kind: value.kind };
    if (value.kind === "counter" && isPositiveInteger(value.counter)) {
      return { kind: "counter", counter: value.counter, bin: isBin(value.bin) ? value.bin : null };
    }
  } catch {
    // Not ours any more: ask again.
  }
  return null;
}

export function saveStation(station: Station | null): void {
  try {
    if (station) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(station));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing: the choice holds until the page closes.
  }
}

const EDITION_KEY = "devfest-arrivals-edition";

/**
 * The edition this device last opened the zone on, so the zone still opens
 * when the backend does not answer (RG-ARR-64): the screens then show they
 * are cut off instead of a dead end. Not personal data, and only ever written
 * after the backend granted access.
 */
export function rememberArrivalsEdition(edition: { id: number; year: number } | null): void {
  try {
    if (edition) window.localStorage.setItem(EDITION_KEY, JSON.stringify({ id: edition.id, year: edition.year }));
    else window.localStorage.removeItem(EDITION_KEY);
  } catch {
    // Without storage, an outage shows the error instead.
  }
}

export function recallArrivalsEdition(): { id: number; year: number } | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(EDITION_KEY) ?? "null") as Record<string, unknown> | null;
    if (value && isPositiveInteger(value.id) && isPositiveInteger(value.year)) return { id: value.id, year: value.year };
  } catch {
    // Unreadable: as if never stored.
  }
  return null;
}

export function stationLabel(station: Station): string {
  if (station.kind === "scan") return "Scan";
  if (station.kind === "help") return "Aide";
  return station.bin !== null ? `Guichet ${station.counter} · bac ${station.bin}` : `Guichet ${station.counter}`;
}
