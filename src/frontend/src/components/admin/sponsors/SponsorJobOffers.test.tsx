import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// TipTap does not run in jsdom; a textarea stands in so the test can type HTML.
vi.mock("@/components/admin/RichTextEditor", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/components/admin/AuditTrail", () => ({ default: () => null }));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: SponsorJobOffers } = await import("./SponsorJobOffers");

const OFFER = { id: 7, title: "Architecte Cloud", descriptionFr: "<p>Poste</p>", descriptionEn: "", url: "https://jobs.example.org/7" };

// GET answers with the participation's offers; writes answer with `writeStatus`.
function mockApi(offers: (typeof OFFER)[], quota: number, writeStatus = 201) {
  adminFetch.mockImplementation(async (_path: string, options?: RequestInit) => {
    if (!options?.method) return { data: { quota, offers }, status: 200 };
    return { data: options.method === "DELETE" ? null : OFFER, status: writeStatus };
  });
}

function writes() {
  return adminFetch.mock.calls.filter(([, options]) => options?.method);
}

describe("SponsorJobOffers (#609)", () => {
  beforeEach(() => adminFetch.mockReset());

  it("lets the team publish past the quota, and says so before the click", async () => {
    mockApi([OFFER], 1);
    render(<SponsorJobOffers sponsorId={3} editionId={9} year={2026} />);

    fireEvent.change(await screen.findByLabelText("Intitulé du poste"), { target: { value: "Product Owner" } });
    fireEvent.change(screen.getByLabelText("Lien vers l'offre"), { target: { value: "https://jobs.example.org/8" } });

    expect(screen.getByText("Cette offre dépassera le quota du niveau (1).")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][0]).toBe("/sponsors/3/editions/9/job-offers");
    expect(await screen.findByText("Offre publiée.")).toBeInTheDocument();
  });

  it("opens the offer the cross-sponsor list points at", async () => {
    mockApi([OFFER], 2);
    render(<SponsorJobOffers sponsorId={3} editionId={9} year={2026} focusOfferId={7} />);

    expect(await screen.findByDisplayValue("Architecte Cloud")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
  });

  it("sends a deleted offer to the trash after confirmation", async () => {
    mockApi([OFFER], 2, 204);
    render(<SponsorJobOffers sponsorId={3} editionId={9} year={2026} />);

    fireEvent.click(await screen.findByRole("button", { name: "Supprimer l'offre Architecte Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(writes()).toEqual([["/job-offers/7", { method: "DELETE" }]]));
    expect(await screen.findByText("Offre déplacée dans la corbeille.")).toBeInTheDocument();
  });

  it("explains that a sponsor absent from the year has no offers to manage", async () => {
    adminFetch.mockResolvedValue({ data: null, status: 404 });
    render(<SponsorJobOffers sponsorId={3} editionId={9} year={2025} />);

    expect(await screen.findByText(/ne participe pas à l'édition 2025/)).toBeInTheDocument();
  });
});
