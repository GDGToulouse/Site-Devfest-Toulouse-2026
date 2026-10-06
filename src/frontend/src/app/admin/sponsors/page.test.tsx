import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #498 — the sponsors list filters by publication status and sorts by column.
// Status, tier and edition belong to the participation (#129): a company
// published on 2026 may still be a draft on 2025, so both read the year picked.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: SponsorsDataPage } = await import("./page");

const PLATINUM = { id: 1, key: "platinum", nameFr: "Platinum", nameEn: "Platinum", rank: 40 };
const GOLD = { id: 2, key: "gold", nameFr: "Gold", nameEn: "Gold", rank: 30 };
const SILVER = { id: 3, key: "silver", nameFr: "Silver", nameEn: "Silver", rank: 20 };

function participation(year: number, tier: typeof GOLD, status: "DRAFT" | "PUBLISHED") {
  return { editionId: year, edition: { id: year, year }, tier, publicationStatus: status };
}

// Newest participation first, as the API sends them.
const SPONSORS = [
  { id: 1, name: "Aeronova", tier: GOLD, publicationStatus: "PUBLISHED", editions: [participation(2026, GOLD, "PUBLISHED"), participation(2025, SILVER, "DRAFT")] },
  { id: 2, name: "Cassoulet Code", tier: PLATINUM, publicationStatus: "PUBLISHED", editions: [participation(2025, PLATINUM, "PUBLISHED")] },
  { id: 3, name: "Brique Rose", tier: SILVER, publicationStatus: "DRAFT", editions: [participation(2026, SILVER, "DRAFT")] },
];

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockImplementation((path: string) =>
    Promise.resolve({ data: path === "/sponsors" ? SPONSORS : [PLATINUM, GOLD, SILVER], status: 200 }),
  );
});

const names = () => screen.getAllByRole("row").slice(1).map((r) => r.querySelectorAll("td")[1].textContent);

describe("Sponsors list — status filter and sorting (#498)", () => {
  it("should show the drafts of the year picked, including companies published on another year", async () => {
    render(<SponsorsDataPage />);
    await screen.findByText("Aeronova");

    await userEvent.selectOptions(screen.getByLabelText("Édition"), "2025");
    await userEvent.selectOptions(screen.getByLabelText("Statut"), "DRAFT");

    expect(names()).toEqual(["Aeronova"]);
  });

  it("should combine the status filter with the others across all editions", async () => {
    render(<SponsorsDataPage />);
    await screen.findByText("Aeronova");

    await userEvent.selectOptions(screen.getByLabelText("Statut"), "PUBLISHED");

    expect(names()).toEqual(["Aeronova", "Cassoulet Code"]);
  });

  it("should sort the tier column in the public page's order, most important first", async () => {
    render(<SponsorsDataPage />);
    await screen.findByText("Aeronova");

    await userEvent.click(screen.getByRole("button", { name: "Niveau" }));

    expect(names()).toEqual(["Cassoulet Code", "Aeronova", "Brique Rose"]);
  });
});
