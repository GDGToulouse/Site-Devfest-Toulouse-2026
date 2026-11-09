import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import type { SponsorScan } from "@/lib/sponsor-api";

// #813 — the people a sponsor's booth met: each line names the person, or
// shows the code as read when it is no valid badge.

const getSponsorScans = vi.fn();
vi.mock("@/lib/sponsor-api", () => ({
  getSponsorScans: (...args: unknown[]) => getSponsorScans(...args),
  sponsorScansExportUrl: (id: number) => `/api/sponsor-space/${id}/scans/export`,
}));

const { default: ScansTab } = await import("./ScansTab");

const KNOWN: SponsorScan = {
  id: 1,
  scannedAt: "2026-11-19T09:30:00Z",
  scannedBy: "Inès Garcia",
  attendee: { firstName: "Hélène", lastName: "Martin", company: "Cassoulet SA" },
  code: null,
};
const UNKNOWN: SponsorScan = { id: 2, scannedAt: "2026-11-19T09:31:00Z", scannedBy: "Inès Garcia", attendee: null, code: "https://example.org/x" };

beforeEach(() => getSponsorScans.mockReset());

describe("ScansTab", () => {
  it("should list the people met, the unrecognised codes as read, and offer the export", async () => {
    getSponsorScans.mockResolvedValue({ status: 200, data: { year: 2026, scans: [KNOWN, UNKNOWN] } });

    render(<ScansTab sponsorId={7} />);

    expect(await screen.findByText("Hélène Martin")).toBeTruthy();
    expect(screen.getByText("Cassoulet SA")).toBeTruthy();
    expect(screen.getByText("https://example.org/x")).toBeTruthy();
    expect(screen.getByText("1 contact · 1 code non reconnu")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Exporter en CSV" }).getAttribute("href")).toBe("/api/sponsor-space/7/scans/export");
    expect(screen.getByRole("link", { name: "Scanner un badge" }).getAttribute("href")).toBe("/sponsor/7/scan");
  });

  it("should offer no export before the first scan", async () => {
    getSponsorScans.mockResolvedValue({ status: 200, data: { year: 2026, scans: [] } });

    render(<ScansTab sponsorId={7} />);

    expect(await screen.findByText("Aucun badge scanné pour l'instant.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Exporter en CSV" })).toBeNull();
  });

  it("should say so when the sponsor is not in the current edition", async () => {
    getSponsorScans.mockResolvedValue({ status: 422, data: null });

    render(<ScansTab sponsorId={7} />);

    expect(await screen.findByText(/ne participe pas à l'édition en cours/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Scanner un badge" })).toBeNull();
  });

  it("should not pass a dropped connection off as an empty list", async () => {
    getSponsorScans.mockResolvedValue({ status: 0, data: null });

    render(<ScansTab sponsorId={7} />);

    expect((await screen.findByRole("alert")).textContent).toContain("n'a pas pu être chargée");
    expect(screen.queryByText("Aucun badge scanné pour l'instant.")).toBeNull();
  });
});
