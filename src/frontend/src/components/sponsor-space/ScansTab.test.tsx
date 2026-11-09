import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { SponsorScan } from "@/lib/sponsor-api";

// #813 — the people a sponsor's booth met: each line names the person, or
// shows the code as read when it is no valid badge.

const getSponsorScans = vi.fn();
const saveSponsorScanNote = vi.fn();
vi.mock("@/lib/sponsor-api", () => ({
  SCAN_NOTE_MAX: 500,
  getSponsorScans: (...args: unknown[]) => getSponsorScans(...args),
  saveSponsorScanNote: (...args: unknown[]) => saveSponsorScanNote(...args),
  sponsorScansExportUrl: (id: number) => `/api/sponsor-space/${id}/scans/export`,
}));

const { default: ScansTab } = await import("./ScansTab");

const KNOWN: SponsorScan = {
  id: 1,
  scannedAt: "2026-11-19T09:30:00Z",
  scannedBy: "Inès Garcia",
  attendee: { firstName: "Hélène", lastName: "Martin", company: "Cassoulet SA" },
  code: null,
  note: null,
};
const UNKNOWN: SponsorScan = {
  id: 2,
  scannedAt: "2026-11-19T09:31:00Z",
  scannedBy: "Inès Garcia",
  attendee: null,
  code: "https://example.org/x",
  note: null,
};

beforeEach(() => {
  getSponsorScans.mockReset();
  saveSponsorScanNote.mockReset();
});

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

  it("should add a note to a contact and show who wrote it (#815)", async () => {
    getSponsorScans.mockResolvedValue({ status: 200, data: { year: 2026, scans: [KNOWN] } });
    saveSponsorScanNote.mockResolvedValue({
      status: 200,
      data: { scan: { ...KNOWN, note: { text: "Rappeler lundi", updatedAt: "2026-11-19T10:12:00Z", updatedBy: "Paul Éditeur" } } },
    });
    render(<ScansTab sponsorId={7} />);

    fireEvent.click(await screen.findByRole("button", { name: "Ajouter une note" }));
    fireEvent.change(screen.getByLabelText(/Note sur l'échange/), { target: { value: "Rappeler lundi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la note" }));

    expect(await screen.findByText("Rappeler lundi")).toBeTruthy();
    expect(screen.getByText(/Modifiée par Paul Éditeur/)).toBeTruthy();
    expect(saveSponsorScanNote).toHaveBeenCalledWith(7, 1, "Rappeler lundi");
  });

  it("should keep the note typed on screen when it could not be saved (#815)", async () => {
    getSponsorScans.mockResolvedValue({ status: 200, data: { year: 2026, scans: [KNOWN] } });
    saveSponsorScanNote.mockResolvedValue({ status: 0, data: null });
    render(<ScansTab sponsorId={7} />);

    fireEvent.click(await screen.findByRole("button", { name: "Ajouter une note" }));
    fireEvent.change(screen.getByLabelText(/Note sur l'échange/), { target: { value: "Rappeler lundi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la note" }));

    expect((await screen.findByRole("alert")).textContent).toContain("vérifiez la connexion");
    expect((screen.getByLabelText(/Note sur l'échange/) as HTMLTextAreaElement).value).toBe("Rappeler lundi");
  });

  it("should not pass a dropped connection off as an empty list", async () => {
    getSponsorScans.mockResolvedValue({ status: 0, data: null });

    render(<ScansTab sponsorId={7} />);

    expect((await screen.findByRole("alert")).textContent).toContain("n'a pas pu être chargée");
    expect(screen.queryByText("Aucun badge scanné pour l'instant.")).toBeNull();
  });
});
