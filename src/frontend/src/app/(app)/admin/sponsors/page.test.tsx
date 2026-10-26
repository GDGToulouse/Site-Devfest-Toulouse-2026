import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #574 — the sponsors list asks the API for one page with the follow-up of the
// year looked at, and keeps its filters in the URL, as the speakers list
// (#572). What the filters mean is the API's: tested in admin-sponsors-list.
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/admin/sponsors",
  useSearchParams: () => searchParams,
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: SponsorsDataPage } = await import("./page");

const GOLD = { id: 2, key: "gold", nameFr: "Gold", nameEn: "Gold", rank: 30 };
const row = {
  id: 1,
  name: "Aeronova",
  tier: GOLD,
  tierRank: 30,
  status: "DRAFT",
  year: 2026,
  comKitReceived: false,
  hasLogo: false,
  contactState: "pending",
  jobOfferCount: 0,
  hasDescription: true,
  hasWebsite: false,
};

beforeEach(() => {
  replace.mockReset();
  searchParams = new URLSearchParams();
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string) => {
    if (path === "/editions") return { status: 200, data: [{ id: 1, year: 2026 }] };
    if (path === "/sponsor-tiers") return { status: 200, data: [GOLD] };
    return { status: 200, data: { page: 1, limit: 50, total: 1, items: [row] } };
  });
});

const lastListQuery = () =>
  Object.fromEntries(
    new URLSearchParams(
      adminFetch.mock.calls.map(([path]) => path as string).filter((p) => p.startsWith("/sponsors?")).at(-1)!.split("?")[1],
    ),
  );

describe("SponsorsDataPage (#574)", () => {
  it("should ask the API for the follow-up of the year held in the URL", async () => {
    searchParams = new URLSearchParams("year=2026&comKit=missing&contacts=pending&tier=gold");
    render(<SponsorsDataPage />);
    await screen.findByText("Aeronova");

    expect(lastListQuery()).toEqual({ page: "1", limit: "50", editionId: "1", tierKey: "gold", comKit: "missing", contacts: "pending" });
  });

  it("should keep the follow-up of the year off until an edition is chosen", async () => {
    render(<SponsorsDataPage />);
    await screen.findByText("Aeronova");

    expect(screen.getByRole("combobox", { name: "Kit de communication" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Offres d'emploi" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Accès à l'espace partenaire" })).toBeEnabled();
  });

  it("should write a filter to the URL and go back to the first page", async () => {
    searchParams = new URLSearchParams("year=2026&page=2");
    render(<SponsorsDataPage />);
    await screen.findByText("Aeronova");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Logo de l'année" }), "missing");

    expect(replace).toHaveBeenCalledWith("/admin/sponsors?year=2026&logo=missing", { scroll: false });
  });

  it("should flag the gaps of the company and where its access stands", async () => {
    searchParams = new URLSearchParams("year=2026");
    render(<SponsorsDataPage />);

    expect(await screen.findByText("Sans logo, site web")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Invitation en attente" })).toBeInTheDocument();
  });

  it("should ask the server for the tier order when the column is clicked", async () => {
    render(<SponsorsDataPage />);
    await screen.findByText("Aeronova");

    await userEvent.click(screen.getByRole("button", { name: /^Niveau/ }));

    expect(replace).toHaveBeenCalledWith("/admin/sponsors?sort=tier&order=asc", { scroll: false });
  });
});
