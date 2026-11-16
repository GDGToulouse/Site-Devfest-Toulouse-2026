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

describe("BadgesSection, the bins table", () => {
  it("should show each bin's numbers from its place 00", async () => {
    renderWith({ badgesPerBin: 100, bins: [{ counter: 1, bin: 1, count: 85 }] });

    expect(await screen.findByText("1 1 00 à 1 1 99")).toBeInTheDocument();
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

describe("BadgesSection, the badges without separators (#835)", () => {
  it("should ask for the print file without the bin pages", async () => {
    renderWith({ frozenAt: "2026-11-03T21:25:30.010Z" });
    const download = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Disposition": 'attachment; filename="badges-2026-sans-separateurs.pdf"' }),
      blob: async () => new Blob(["pdf"]),
    });
    vi.stubGlobal("fetch", download);
    URL.createObjectURL = vi.fn(() => "blob:badges");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(await screen.findByRole("button", { name: "Télécharger les badges sans séparateurs" }));

    await vi.waitFor(() => expect(download).toHaveBeenCalledWith("/api/admin/badges/1/pdf?separators=false", { credentials: "include" }));
    vi.unstubAllGlobals();
  });
});

describe("BadgesSection, the blank badges (#841)", () => {
  const blankDesign = (speaker: number) => ({
    types: { SPEAKER: { background: null, backBackground: null, color: "#FFFFFF", blanks: speaker } },
  });

  it("should ask for the printer's A4 plates once A4 is chosen, without the separators button (#846)", async () => {
    renderWith({ frozenAt: "2026-11-03T21:25:30.010Z", design: blankDesign(1) });
    const download = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Disposition": 'attachment; filename="badges-2026-a4.pdf"' }),
      blob: async () => new Blob(["pdf"]),
    });
    vi.stubGlobal("fetch", download);
    URL.createObjectURL = vi.fn(() => "blob:badges");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(await screen.findByLabelText(/A4, plaques de 4/));
    fireEvent.click(screen.getByRole("button", { name: "Télécharger le PDF d'impression" }));

    await vi.waitFor(() => expect(download).toHaveBeenCalledWith("/api/admin/badges/1/pdf?format=a4", { credentials: "include" }));
    expect(screen.queryByRole("button", { name: "Télécharger les badges sans séparateurs" })).toBeNull();
    vi.unstubAllGlobals();
  });

  it("should download the blank badges alone, and say how many", async () => {
    renderWith({ design: blankDesign(4) });
    const download = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Disposition": 'attachment; filename="badges-2026-vierges.pdf"' }),
      blob: async () => new Blob(["pdf"]),
    });
    vi.stubGlobal("fetch", download);
    URL.createObjectURL = vi.fn(() => "blob:badges");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(await screen.findByRole("button", { name: "Télécharger les badges vierges (4)" }));

    await vi.waitFor(() => expect(download).toHaveBeenCalledWith("/api/admin/badges/1/pdf?only=blanks", { credentials: "include" }));
    vi.unstubAllGlobals();
  });
});
