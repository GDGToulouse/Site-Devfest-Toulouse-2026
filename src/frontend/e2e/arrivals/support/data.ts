import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// What the global setup learned and the tests need: the fixture edition, its
// tickets (with the QR code the faked camera shows), and the link of each station.

export const ATTENDEE_KEYS = [
  "camera",
  "search",
  "counter",
  "cancelled",
  "already",
  "dedicated",
  "nobadge",
  "help",
  "outage",
  "layout",
] as const;

export type AttendeeKey = (typeof ATTENDEE_KEYS)[number];

export interface FixtureAttendee {
  id: number;
  barcode: string;
  firstName: string;
  lastName: string;
  number: number | null;
  /** PNG data URL of the ticket's QR code. */
  qr: string;
}

export interface E2EData {
  editionId: number;
  attendees: Record<AttendeeKey, FixtureAttendee>;
  /** Station link by code: `scan`, `help`, `c1`, `c2`… */
  stations: Record<string, string>;
}

const FILE = join(__dirname, "..", "..", ".run", "data.json");

export function saveData(data: E2EData): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(data));
}

export function loadData(): E2EData {
  return JSON.parse(readFileSync(FILE, "utf8")) as E2EData;
}
