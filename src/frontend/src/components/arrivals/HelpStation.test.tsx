import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { SearchHit } from "@/lib/arrivals-api";

// #826 — the help desk says what each action did, where the volunteer is
// looking, and whether the person's arrival is recorded.

const scanTicket = vi.fn();
const searchAttendees = vi.fn();
vi.mock("@/lib/arrivals-api", () => ({
  scanTicket: (...args: unknown[]) => scanTicket(...args),
  searchAttendees: (...args: unknown[]) => searchAttendees(...args),
  cancelScan: vi.fn(),
  deliverLabel: vi.fn(),
  markWithdrawn: vi.fn(),
  printFreeLabel: vi.fn(),
  printLabel: vi.fn(),
}));
// The camera reads a code as soon as it opens.
vi.mock("@/components/arrivals/CodeScanner", () => ({
  default: ({ onRead }: { onRead: (code: string) => void }) => (
    <button type="button" onClick={() => onRead("2026000001")}>
      Lire le billet
    </button>
  ),
}));

const { default: HelpStation } = await import("./HelpStation");

const EDITION = { id: 7, year: 2026 };
const WITH_BADGE: SearchHit = {
  id: 1,
  firstName: "Hélène",
  lastName: "Martin",
  company: "Cassoulet SA",
  tierName: "Normal",
  badgeNumber: 2147,
  badgeState: "PRINTED",
  isCancelled: false,
  isDedicated: false,
  scannedAt: null,
  scannedBy: null,
  labelCount: 0,
  labelDeliveredAt: null,
};
const WITHOUT_BADGE: SearchHit = { ...WITH_BADGE, id: 2, firstName: "Paul", lastName: "Sansbadge", badgeNumber: null };

beforeEach(() => {
  scanTicket.mockReset();
  searchAttendees.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

async function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: /Chercher quelqu/ }), { target: { value: text } });
}

describe("HelpStation", () => {
  it("should say the ticket was scanned and where to send the person, on their page brought into view", async () => {
    scanTicket.mockResolvedValue({
      status: 200,
      data: {
        result: "badge",
        attendee: WITH_BADGE,
        badge: { id: 1, number: 2147, state: "TO_FETCH" },
        alreadyScanned: null,
      },
    });
    searchAttendees.mockResolvedValue({ status: 200, data: [{ ...WITH_BADGE, scannedAt: new Date().toISOString(), scannedBy: "Poste aide" }] });
    render(<HelpStation edition={EDITION} live={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Scanner un billet" }));
    fireEvent.click(screen.getByRole("button", { name: "Lire le billet" }));

    const notice = await screen.findByRole("status");
    expect(notice.textContent).toMatch(/Billet scanné à .*Envoyez la personne au guichet 2, badge 2 1 47/);
    const title = screen.getByRole("heading", { name: "Hélène Martin" });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(title.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText(/Scanné à .* par Poste aide/)).toBeTruthy();
  });

  it("should say who scanned the ticket first when it was already scanned", async () => {
    scanTicket.mockResolvedValue({
      status: 200,
      data: { result: "help", attendee: WITHOUT_BADGE, alreadyScanned: { at: "2026-11-19T07:40:00Z", by: "Poste scan 1" } },
    });
    searchAttendees.mockResolvedValue({ status: 200, data: [{ ...WITHOUT_BADGE, scannedAt: "2026-11-19T07:40:00Z", scannedBy: "Poste scan 1" }] });
    render(<HelpStation edition={EDITION} live={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Scanner un billet" }));
    fireEvent.click(screen.getByRole("button", { name: "Lire le billet" }));

    expect((await screen.findByRole("status")).textContent).toContain("Déjà scanné à 8 h 40 par Poste scan 1.");
  });

  it("should fold the results away once someone is picked, and bring them back on demand", async () => {
    searchAttendees.mockResolvedValue({ status: 200, data: [WITH_BADGE, WITHOUT_BADGE] });
    render(<HelpStation edition={EDITION} live={null} />);

    await search("ma");
    fireEvent.click(await screen.findByRole("button", { name: /Hélène Martin/ }));

    expect(screen.queryByRole("list", { name: "Résultats de la recherche" })).toBeNull();
    expect(screen.getByText("Pas encore scanné")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revenir aux résultats (2)" }));
    expect(screen.getByRole("list", { name: "Résultats de la recherche" })).toBeTruthy();
  });

  it("should record the arrival of someone with no badge waiting, without a label", async () => {
    searchAttendees.mockResolvedValue({ status: 200, data: [WITHOUT_BADGE] });
    scanTicket.mockResolvedValue({ status: 200, data: { result: "help", attendee: WITHOUT_BADGE, alreadyScanned: null } });
    render(<HelpStation edition={EDITION} live={null} />);

    await search("sansbadge");
    fireEvent.click(await screen.findByRole("button", { name: /Paul Sansbadge/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer l'arrivée" }));

    expect((await screen.findByRole("status")).textContent).toMatch(/Arrivée enregistrée à \d+ h \d{2}/);
    expect(scanTicket).toHaveBeenCalledWith(7, { attendeeId: 2 });
    expect(screen.queryByRole("button", { name: "Enregistrer l'arrivée" })).toBeNull();
  });

  it("should not offer to record the arrival of someone whose badge waits in its bin", async () => {
    searchAttendees.mockResolvedValue({ status: 200, data: [WITH_BADGE] });
    render(<HelpStation edition={EDITION} live={null} />);

    await search("martin");
    fireEvent.click(await screen.findByRole("button", { name: /Hélène Martin/ }));

    expect(screen.getByRole("button", { name: "Envoyer au guichet 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer l'arrivée" })).toBeNull();
  });

  it("should keep a failed action's message on the person's page", async () => {
    searchAttendees.mockResolvedValue({ status: 200, data: [WITH_BADGE] });
    scanTicket.mockResolvedValue({ status: 0, data: null });
    render(<HelpStation edition={EDITION} live={null} />);

    await search("martin");
    fireEvent.click(await screen.findByRole("button", { name: /Hélène Martin/ }));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer au guichet 2" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Le serveur ne répond pas");
  });
});
