// The station a screen works as on event day (RG-ARR-25, #641): Scan, a
// counter (all of its bins: the volunteers behind it serve them all), or Aide. The address is the source
// of truth since #775 (RG-ARR-70): a link names its station, so it can be given
// away, and "Changer de poste" is simply the way back to /arrivees.

export type Station =
  | { kind: "scan" }
  | { kind: "counter"; counter: number }
  | { kind: "help" };

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

/** The address of a station's screen. */
export function stationPath(station: Station): string {
  if (station.kind === "scan") return "/arrivees/scan";
  if (station.kind === "help") return "/arrivees/aide";
  return `/arrivees/guichet/${station.counter}`;
}

/** A counter number from the address, or null when it is not a number from 1 to 9. */
export function parseStationNumber(value: string | undefined): number | null {
  if (value === undefined || !/^[1-9]$/.test(value)) return null;
  return Number(value);
}

/** Whether the station exists in this layout: an address can name a counter the edition does not have. */
export function isStationInLayout(station: Station, layout: { counters: number }): boolean {
  if (station.kind !== "counter") return true;
  return station.counter <= layout.counters;
}

export function isSameStation(a: Station, b: Station): boolean {
  if (a.kind !== "counter" || b.kind !== "counter") return a.kind === b.kind;
  return a.counter === b.counter;
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
  if (station.kind === "help") return "Cas particuliers";
  return `Guichet ${station.counter}`;
}
