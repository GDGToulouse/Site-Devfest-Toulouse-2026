import { createHash } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";

import { loadOfflineTable, lookupOffline, offlineKey, storeOfflineTable, type OfflineTable } from "./arrivals-offline";

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
    expect(await lookupOffline(table(), "1234567890")).toEqual({ kind: "badge", number: 2147 });
    expect(await lookupOffline(table(), "5555555555")).toEqual({ kind: "dedicated" });
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
