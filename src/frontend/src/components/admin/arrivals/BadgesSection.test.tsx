import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { fetchMock, sessionMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), sessionMock: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({
  adminFetch: fetchMock,
  getAdminSession: sessionMock,
  humanError: (_result: unknown, fallback: string) => fallback,
}));
vi.mock("@/components/admin/arrivals/BadgeDesignSection", () => ({ default: () => null }));

import BadgesSection from "./BadgesSection";

// #776: a greyed "Envoyer à l'impression" says why, beside itself, and the
// preview says which page is which type.

const status = {
  counters: 4,
  binsPerCounter: 3,
  badgesPerBin: 99,
  design: {},
  tiers: [],
  capacity: 1188,
  frozenAt: null,
  billetwebBadgeFieldId: null,
  numbered: 1017,
  shortfall: null,
  withoutTier: 0,
  withoutNumber: 0,
  cancelledAfterFreeze: 0,
  isWriting: false,
  scanned: 0,
  isResetAllowed: false,
  written: 0,
  writeErrors: 0,
  bins: [],
};

function renderWith(overrides: Record<string, unknown>) {
  fetchMock.mockResolvedValue({ data: { ...status, ...overrides }, status: 200 });
  return render(<BadgesSection editionId={1} syncedAt={null} onAttendeesReset={() => {}} />);
}

const freezeButton = () => screen.findByRole("button", { name: "Envoyer à l'impression" });

beforeEach(() => {
  fetchMock.mockReset();
  sessionMock.mockReset().mockResolvedValue({ role: "ADMIN" });
});

describe("BadgesSection, the reason a freeze is blocked", () => {
  it("should say how many présentoirs to add when the tickets exceed the capacity", async () => {
    renderWith({ numbered: 1189, shortfall: { capacity: 1188, missingBins: 1, binsPerCounterNeeded: 4 } });

    const button = await freezeButton();

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      "1189 badges pour 1188 places : il manque 1 présentoir. Passez à 4 présentoirs par guichet.",
    );
  });

  it("should say to import the participants when there is nothing to number", async () => {
    renderWith({ numbered: 0 });

    expect(await freezeButton()).toHaveAccessibleDescription(
      "Aucun participant à numéroter : importez d'abord les participants.",
    );
  });

  it("should say how many tickets lack a known tier", async () => {
    renderWith({ withoutTier: 3 });

    expect(await freezeButton()).toHaveAccessibleDescription(/^3 billets n'ont pas de tarif connu/);
  });

  it("should enable the button, with no reason, when the badges can be numbered", async () => {
    renderWith({});

    const button = await freezeButton();

    expect(button).toBeEnabled();
    expect(button).not.toHaveAccessibleDescription();
  });
});

describe("BadgesSection, the preview legend", () => {
  it("should name the type of each page pair after the preview is downloaded", async () => {
    renderWith({ frozenAt: "2026-11-03T21:25:30.010Z" });
    const pages = [
      { type: "PARTICIPANT", name: "Participant", isNumbered: true },
      { type: "STAFF", name: "Staff", isNumbered: false },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "X-Badge-Pages": encodeURIComponent(JSON.stringify(pages)) }),
        blob: async () => new Blob(["pdf"]),
      }),
    );
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    // The download link: jsdom cannot navigate.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(await screen.findByRole("button", { name: /Aperçu/ }));

    expect(await screen.findByText("Participant")).toBeInTheDocument();
    expect(screen.getByText("Pages 3-4")).toBeInTheDocument();
    expect(screen.getByText(/sans numéro : accueil dédié/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
