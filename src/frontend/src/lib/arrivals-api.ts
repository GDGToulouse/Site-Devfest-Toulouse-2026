// The volunteers' side of the arrivals (#640): their invitation, and whether
// the signed-in account may open the event-day screens. Same-origin calls,
// relayed to the backend by next.config.ts.

import type { BadgeState, LiveBadge } from "@/lib/arrivals-live";
import type { OfflineTable, QueuedScan } from "@/lib/arrivals-offline";

export interface ArrivalsResult<T> {
  data: T | null;
  // 0: the request never reached the backend.
  status: number;
  error?: string;
}

export interface ArrivalsInvitation {
  editionYear: number;
  emailHint: string;
}

export interface ArrivalsCurrent {
  edition: { id: number; year: number } | null;
  hasAccess: boolean;
  /** An admin may take a badge back to Imprimé (RG-ARR-46). */
  canStepBack: boolean;
  /** ADMIN and EDITOR open the tracking screen (RG-ARR-26). */
  canTrack: boolean;
}

/** The tracking screen's totals (#644), as the backend computes them. */
export interface TrackingSummary {
  expected: number;
  scanned: number;
  delivered: number;
  waiting: number;
  counters: Array<{ counter: number; numbered: number; toFetch: number; ready: number; delivered: number }>;
  dedicated: { expected: number; scanned: number };
  help: { toHandle: number; labelsDelivered: number; labelsPrinted: number };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<ArrivalsResult<T>> {
  try {
    const res = await fetch(path, { credentials: "include", ...init });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { data: null, status: res.status, ...(body?.error ? { error: body.error } : {}) };
    }
    return { data: (await res.json()) as T, status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

export function getArrivalsInvitation(token: string) {
  return call<ArrivalsInvitation>(`/api/arrivals-invitation/${encodeURIComponent(token)}`);
}

export function acceptArrivalsInvitation(token: string) {
  return call<{ editionYear: number }>(`/api/arrivals-invitation/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });
}

export function getArrivalsCurrent() {
  return call<ArrivalsCurrent>("/api/arrivals/current");
}

// A counter touching a card (#643). The answer is the badge as it stands,
// moved or not: a card that had already moved elsewhere just catches up
// (RG-ARR-44).
export function moveBadge(editionId: number, attendeeId: number, from: BadgeState, to: BadgeState) {
  return call<{ applied: boolean; badge: LiveBadge }>(`/api/arrivals/${editionId}/badges/${attendeeId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
}

// The entrance (#642).

export interface ScanAttendee {
  id: number;
  firstName: string;
  lastName: string;
  company: string | null;
  tierName: string | null;
}

export interface FirstScan {
  at: string;
  by: string | null;
}

export type ScanOutcome =
  | { result: "unknown" }
  | { result: "cancelled"; attendee: ScanAttendee }
  | { result: "dedicated"; attendee: ScanAttendee; alreadyScanned: FirstScan | null }
  | { result: "help"; attendee: ScanAttendee; alreadyScanned: FirstScan | null }
  | { result: "badge"; attendee: ScanAttendee; badge: LiveBadge; alreadyScanned: FirstScan | null };

export interface SearchHit extends ScanAttendee {
  badgeNumber: number | null;
  /** Meaningful with a number only. */
  badgeState: BadgeState;
  isCancelled: boolean;
  isDedicated: boolean;
  scannedAt: string | null;
  labelCount: number;
  labelDeliveredAt: string | null;
}

/**
 * How long a scan waits for the backend before the phone answers from its
 * own table (RG-ARR-64): the person is standing there, and a stalled link
 * otherwise hangs for as long as the browser cares to wait.
 */
const SCAN_TIMEOUT_MS = 4_000;

export function scanTicket(editionId: number, target: { code: string } | { attendeeId: number }) {
  return call<ScanOutcome>(`/api/arrivals/${editionId}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
    signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
  });
}

/** Scans made during an outage, sent once the backend is back (#645). */
export function sendOfflineScans(editionId: number, scans: QueuedScan[]) {
  return call<{ results: Array<{ id: string; result: "recorded" | "already_scanned" | "unmatched" }> }>(
    `/api/arrivals/${editionId}/offline-scans`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scans }),
    },
  );
}

export function searchAttendees(editionId: number, query: string) {
  return call<SearchHit[]>(`/api/arrivals/${editionId}/search?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
  });
}

// The help desk (#713).

export interface LabelText {
  firstName: string;
  lastName: string;
  company: string | null;
}

/** Records the print, then gives the text: a reprint is the same call (RG-ARR-54). */
export function printLabel(editionId: number, attendeeId: number) {
  return call<{ label: LabelText; printCount: number }>(`/api/arrivals/${editionId}/attendees/${attendeeId}/label`, {
    method: "POST",
  });
}

export function deliverLabel(editionId: number, attendeeId: number) {
  return call<{ delivered: true }>(`/api/arrivals/${editionId}/attendees/${attendeeId}/label/delivered`, {
    method: "POST",
  });
}

export function getOfflineTable(editionId: number) {
  return call<OfflineTable>(`/api/arrivals/${editionId}/offline-table`);
}
