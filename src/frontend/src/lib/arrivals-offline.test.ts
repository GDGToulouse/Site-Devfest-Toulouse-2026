import { createHash } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";

import {
  dropFromOfflineQueue,
  loadOfflineQueue,
  loadOfflineTable,
  lookupOffline,
  offlineKey,
  queueOfflineScan,
  storeOfflineTable,
  type OfflineTable,
} from "./arrivals-offline";

// The backend's computation (lib/arrivals-scan.ts), written out: the phone
// must land on the same key, or the degraded mode answers "unknown" to all.
const backendKey = (editionId: number, code: string) =>
  createHash("sha256").update(`devfest-arrivals:${editionId}:${code}`).digest("hex").slice(0, 6);

const table = (expiresAt: string | null = null): OfflineTable => ({
  editionId: 7,
  keyLength: 6,
  expiresAt,
  entries: { [backendKey(7, "1234567890")]: 2147, [backendKey(7, "5555555555")]: 0, [backendKey(7, "4444444444")]: -1 },
});

describe("the Scan phone's degraded mode (RG-ARR-64, #642)", () => {
  beforeEach(() => window.localStorage.clear());

  it("should compute the backend's key for a code", async () => {
    expect(await offlineKey(7, " 1234567890 ", 6)).toBe(backendKey(7, "1234567890"));
  });

  it("should answer the number, the dedicated flow, an ambiguity or nothing", async () => {
    expect(await lookupOffline(table(), "1234567890")).toEqual({
      kind: "badge",
      number: 2147,
      key: backendKey(7, "1234567890"),
    });
    expect(await lookupOffline(table(), "5555555555")).toEqual({ kind: "dedicated", key: backendKey(7, "5555555555") });
    expect(await lookupOffline(table(), "4444444444")).toEqual({ kind: "ambiguous" });
    expect(await lookupOffline(table(), "0000000000")).toEqual({ kind: "unknown" });
  });

  it("should keep the table across a reopening of the application", () => {
    storeOfflineTable(table("2026-11-21T17:00:00Z"));

    expect(loadOfflineTable(7, Date.parse("2026-11-19T08:00:00Z"))?.entries).toEqual(table().entries);
  });

  it("should erase the table once the event is over (RG-ARR-65)", () => {
    storeOfflineTable(table("2026-11-21T17:00:00Z"));

    expect(loadOfflineTable(7, Date.parse("2026-11-22T08:00:00Z"))).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});

describe("the scans kept during an outage (RG-ARR-67, #645)", () => {
  beforeEach(() => window.localStorage.clear());

  it("should keep a number or the dedicated flow, under the code's digest and nothing else", async () => {
    queueOfflineScan(7, await lookupOffline(table(), "1234567890"), new Date("2026-11-19T08:05:00Z"));
    queueOfflineScan(7, await lookupOffline(table(), "5555555555"), new Date("2026-11-19T08:06:00Z"));

    const queue = loadOfflineQueue(7);
    expect(queue.map(({ key, number, scannedAt }) => ({ key, number, scannedAt }))).toEqual([
      { key: backendKey(7, "1234567890"), number: 2147, scannedAt: "2026-11-19T08:05:00.000Z" },
      { key: backendKey(7, "5555555555"), number: 0, scannedAt: "2026-11-19T08:06:00.000Z" },
    ]);
    expect(JSON.stringify(window.localStorage)).not.toContain("1234567890");
  });

  it("should keep nothing for an answer that sent the person to the help desk", async () => {
    queueOfflineScan(7, await lookupOffline(table(), "0000000000"));
    queueOfflineScan(7, await lookupOffline(table(), "4444444444"));

    expect(loadOfflineQueue(7)).toEqual([]);
  });

  it("should keep a ticket read twice during the outage once, at its first reading", async () => {
    const answer = await lookupOffline(table(), "1234567890");
    queueOfflineScan(7, answer, new Date("2026-11-19T08:05:00Z"));
    queueOfflineScan(7, answer, new Date("2026-11-19T08:07:00Z"));

    expect(loadOfflineQueue(7).map((s) => s.scannedAt)).toEqual(["2026-11-19T08:05:00.000Z"]);
  });

  it("should drop what the backend answered for, and leave the rest", async () => {
    const [first] = queueOfflineScan(7, await lookupOffline(table(), "1234567890"));
    queueOfflineScan(7, await lookupOffline(table(), "5555555555"));

    const left = dropFromOfflineQueue(7, [first.id]);

    expect(left.map((s) => s.number)).toEqual([0]);
    expect(dropFromOfflineQueue(7, [left[0].id])).toEqual([]);
    expect(window.localStorage.length).toBe(0);
  });
});
