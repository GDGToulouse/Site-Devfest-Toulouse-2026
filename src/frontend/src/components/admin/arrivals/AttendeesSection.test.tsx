import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const { fetchMock, replace } = vi.hoisted(() => ({ fetchMock: vi.fn(), replace: vi.fn() }));
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/arrivals",
  useSearchParams: () => searchParams,
}));
vi.mock("@/lib/admin-api", () => ({ adminFetch: fetchMock }));

import AttendeesSection, { badgeStatus, type AttendeeRow } from "./AttendeesSection";

// The admin's list of attendees (#806): where each arrival stands, here and
// on Billetweb, in the words the stations use.

const row = (overrides: Partial<AttendeeRow> = {}): AttendeeRow => ({
  id: 1,
  firstName: "Hélène",
  lastName: "Martin",
  company: "Cassoulet SA",
  tierName: "Normal",
  isOutsideFlow: false,
  badgeNumber: 1205,
  badgeState: "PRINTED",
  labelDelivered: false,
  isCancelled: false,
  isWithdrawn: false,
  scannedAt: null,
  scannedBy: null,
  scannedOffline: false,
  billetweb: "none",
  checkInError: null,
  ...overrides,
});

const SCANNED = "2026-11-20T08:30:00Z";

describe("badgeStatus", () => {
  it("should say where the badge is, as a station would", () => {
    expect(badgeStatus(row()).label).toBe("Pas arrivé");
    expect(badgeStatus(row({ scannedAt: SCANNED, badgeState: "TO_FETCH" })).label).toBe("À chercher");
    // Checked in by Billetweb Scan: the badge never reached the counter's screen.
    expect(badgeStatus(row({ scannedAt: SCANNED, badgeState: "PRINTED" })).label).toBe("Scanné, pas au guichet");
    expect(badgeStatus(row({ scannedAt: SCANNED, badgeState: "READY" })).label).toBe("Prêt");
    expect(badgeStatus(row({ scannedAt: SCANNED, badgeState: "DELIVERED" })).label).toBe("Distribué");
    expect(badgeStatus(row({ scannedAt: SCANNED, badgeState: "DELIVERED", labelDelivered: true })).label).toBe("Étiquette remise");
  });

  it("should send a scanned ticket with no badge to Cas particuliers, and a dedicated one to its reception", () => {
    expect(badgeStatus(row({ scannedAt: SCANNED, badgeNumber: null })).label).toBe("Sans badge : Cas particuliers");
    expect(badgeStatus(row({ scannedAt: SCANNED, badgeNumber: null, isOutsideFlow: true })).label).toBe("Accueil dédié");
  });

  it("should flag a refunded badge until it is taken back", () => {
    expect(badgeStatus(row({ isCancelled: true }))).toEqual({ label: "Remboursé, badge à retirer", variant: "red" });
    expect(badgeStatus(row({ isCancelled: true, isWithdrawn: true })).label).toBe("Remboursé, badge retiré");
    expect(badgeStatus(row({ isCancelled: true, badgeNumber: null })).label).toBe("Billet annulé");
  });
});

describe("AttendeesSection", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    fetchMock.mockReset();
  });

  it("should show each attendee with the badge, the scan and Billetweb's state", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      data: {
        page: 1,
        limit: 50,
        total: 1,
        items: [
          row({
            scannedAt: SCANNED,
            scannedBy: "Poste Scan",
            badgeState: "TO_FETCH",
            billetweb: "error",
            checkInError: "HTTP 500",
          }),
        ],
      },
    });

    render(<AttendeesSection editionId={7} />);

    const line = (await screen.findByText("Hélène Martin")).closest("tr")!;
    expect(within(line).getByText("1 2 05")).toBeTruthy();
    expect(within(line).getByText("À chercher")).toBeTruthy();
    expect(within(line).getByText("Poste Scan")).toBeTruthy();
    expect(within(line).getByText("Échec, nouvel essai chaque minute")).toBeTruthy();
    expect(within(line).getByText("HTTP 500")).toBeTruthy();
  });

  it("should ask the backend for the filter and search kept in the address", async () => {
    searchParams = new URLSearchParams("filter=checkin_issue&search=martin&page=2");
    fetchMock.mockResolvedValue({ status: 200, data: { page: 2, limit: 50, total: 0, items: [] } });

    render(<AttendeesSection editionId={7} />);

    await screen.findByText("Aucun participant ne correspond.");
    expect(fetchMock).toHaveBeenCalledWith("/attendees/list/7?page=2&limit=50&search=martin&filter=checkin_issue");
  });

  it("should say so when the list cannot be loaded", async () => {
    fetchMock.mockResolvedValue({ status: 0, data: null });

    render(<AttendeesSection editionId={7} />);

    expect((await screen.findByRole("alert")).textContent).toContain("La liste n'a pas pu être chargée");
  });
});
