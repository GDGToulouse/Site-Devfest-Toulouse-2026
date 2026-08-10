import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// #393 — a new sponsor arrived with "Platinum" already selected, silently: the
// tier list is sorted by rank desc, so data[0] is the most prominent (and most
// expensive) offer. Nobody chose it. The default is now the lowest rank — the
// cheapest mistake to make, and the one an editor is most likely to correct.

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "new" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

vi.mock("@/components/admin/RichTextEditor", () => ({
  default: ({ name }: { name: string }) => <textarea data-testid={name} />,
}));

const { default: SponsorEditorPage } = await import("./[id]/page");

// As the API returns them: rank descending.
const TIERS = [
  { id: 1, key: "platinum", nameFr: "Platinum", nameEn: "Platinum", rank: 30, allowsPromoIdeas: true },
  { id: 2, key: "gold", nameFr: "Gold", nameEn: "Gold", rank: 20, allowsPromoIdeas: false },
  { id: 3, key: "soutien", nameFr: "Soutien", nameEn: "Support", rank: 10, allowsPromoIdeas: false },
];

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockImplementation((path: string) => {
    if (path === "/sponsor-tiers") return Promise.resolve({ data: TIERS, status: 200 });
    if (path === "/editions") return Promise.resolve({ data: [{ id: 1, year: 2026 }], status: 200 });
    return Promise.resolve({ data: [], status: 200 });
  });
});

describe("New sponsor — the pre-selected tier (#393)", () => {
  it("does not pre-select the most prominent tier", async () => {
    render(<SponsorEditorPage />);

    const tier = (await screen.findByRole("combobox", { name: /Niveau/ })) as HTMLSelectElement;
    expect(tier.value).not.toBe("1");
    // The lowest rank, chosen deliberately: an accidental "Soutien" is a
    // cheaper error to discover than an accidental "Platinum".
    expect(tier.value).toBe("3");
  });
});
