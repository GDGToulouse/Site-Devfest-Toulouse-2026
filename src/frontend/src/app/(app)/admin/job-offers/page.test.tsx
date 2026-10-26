import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #609 — every sponsor's job offers in one list. What the filters mean is the
// API's (admin-job-offers.test.ts); this checks the page asks for them and
// leads to the sponsor's sheet, where offers are edited.
const push = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/admin/job-offers",
  useSearchParams: () => searchParams,
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: JobOffersPage } = await import("./page");

const row = {
  id: 7,
  title: "Architecte Cloud",
  url: "https://jobs.example.org/7",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-02T10:00:00.000Z",
  sponsor: { id: 3, name: "Aeronova" },
  editionId: 9,
  year: 2026,
  tierName: "Gold",
};

beforeEach(() => {
  push.mockReset();
  searchParams = new URLSearchParams();
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string) => {
    if (path === "/editions") return { status: 200, data: [{ id: 9, year: 2026 }] };
    if (path.startsWith("/sponsors")) return { status: 200, data: [{ id: 3, name: "Aeronova" }] };
    return { status: 200, data: { page: 1, limit: 50, total: 1, items: [row] } };
  });
});

describe("Admin job offers list (#609)", () => {
  it("asks the API for the year and sponsor in the URL", async () => {
    searchParams = new URLSearchParams("year=2026&sponsor=3");
    render(<JobOffersPage />);

    await screen.findByText("Architecte Cloud");
    const listCall = adminFetch.mock.calls.map(([path]) => path).find((p: string) => p.startsWith("/job-offers"));

    expect(new URLSearchParams(listCall.split("?")[1]).toString()).toBe("page=1&limit=50&editionId=9&sponsorId=3");
  });

  it("opens the offer on its sponsor's sheet, on the offers tab of its year", async () => {
    render(<JobOffersPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Modifier Architecte Cloud" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/sponsors/3?tab=offres&editionId=9&offer=7"));
  });
});
