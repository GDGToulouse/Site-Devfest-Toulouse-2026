import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #393 — the sheet stacked identity and participation on one 2300px screen, so
// nothing said which of the two an edit applied to. An organizer who attached
// 2025 and scrolled back up to change "the logo" overwrote the 2026 one. These
// lock the split: the year is always on screen, and each panel says its scope.

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "42" }),
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

// The rich-text editor drags in a heavy tree that has nothing to do with the
// tab split; stub it down to a plain textarea.
vi.mock("@/components/admin/RichTextEditor", () => ({
  default: ({ name }: { name: string }) => <textarea data-testid={name} />,
}));

const { default: SponsorEditorPage } = await import("./page");

const TIERS = [
  { id: 1, key: "platinum", nameFr: "Platinum", nameEn: "Platinum", rank: 30, allowsPromoIdeas: true },
  { id: 2, key: "gold", nameFr: "Gold", nameEn: "Gold", rank: 20, allowsPromoIdeas: false },
  { id: 3, key: "soutien", nameFr: "Soutien", nameEn: "Support", rank: 10, allowsPromoIdeas: false },
];

const SPONSOR = {
  id: 42,
  slug: "garonne-digital",
  name: "Garonne Digital",
  tierId: 2,
  logoUrl: "/logos/2025.svg",
  websiteUrl: "https://example.com",
  descriptionFr: "",
  descriptionEn: "",
  socialLinks: {},
  locale: "fr",
  publicationStatus: "PUBLISHED",
  editionId: 2,
  edition: { id: 2, year: 2025 },
};

beforeEach(() => {
  adminFetch.mockReset();
  replace.mockReset();
  adminFetch.mockImplementation((path: string) => {
    if (path === "/sponsor-tiers") return Promise.resolve({ data: TIERS, status: 200 });
    if (path === "/sponsors/42") return Promise.resolve({ data: SPONSOR, status: 200 });
    if (path === "/editions") return Promise.resolve({ data: [{ id: 1, year: 2026 }, { id: 2, year: 2025 }], status: 200 });
    return Promise.resolve({ data: [], status: 200 });
  });
});

describe("Sponsor sheet — the edited year is always visible (#393)", () => {
  it("names the year in the participation tab", async () => {
    render(<SponsorEditorPage />);

    // The year used to be a 14px grey line at the top, 130px above the logo
    // field it scoped. It is now part of a tab label, so it cannot scroll away.
    expect(await screen.findByRole("tab", { name: "Participation 2025" })).toBeInTheDocument();
  });

  it("scopes the logo and tier labels to that year", async () => {
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "Participation 2025" }));

    // "Logo" alone was the whole problem: it read as the company's logo.
    expect(screen.getByText("Logo 2025")).toBeInTheDocument();
    expect(screen.getByText("Niveau 2025 *")).toBeInTheDocument();
  });
});

describe("Sponsor sheet — panels separate identity from participation (#393)", () => {
  it("opens on identity and says the scope is every edition", async () => {
    render(<SponsorEditorPage />);

    expect(await screen.findByRole("heading", { name: "Identité de l'entreprise", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/vaut pour chaque année/)).toBeInTheDocument();
  });

  it("keeps identity fields out of the participation panel", async () => {
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    // Identity tab: the name is here, the tier is not.
    expect(await screen.findByLabelText("Nom *")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Participation 2025" }));
    expect(screen.queryByLabelText("Nom *")).not.toBeInTheDocument();
    expect(screen.getByText("Niveau 2025 *")).toBeInTheDocument();
  });

  it("gives every panel a heading of its own", async () => {
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    // The screen had a single <h1> and no <h2> at all: nothing to navigate by.
    await user.click(await screen.findByRole("tab", { name: "Kit de com" }));
    // The heading names the year too (#429): the com kit is year-scoped like
    // the participation, and its tab label does not say so.
    expect(screen.getByRole("heading", { name: "Kit de com 2025", level: 2 })).toBeInTheDocument();
  });

  it("wires the panel to its tab for assistive tech", async () => {
    render(<SponsorEditorPage />);

    const tab = await screen.findByRole("tab", { name: "Identité" });
    // Scoped by id: the description field nests its own FR/EN tabpanel inside
    // this one, so an unqualified tabpanel query matches both.
    const panel = document.getElementById("sponsor-panel-identite");
    expect(tab).toHaveAttribute("aria-controls", "sponsor-panel-identite");
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("remembers the open tab in the URL", async () => {
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "Contacts & accès" }));

    // Same as the edition sheet: reloading or sharing the link reopens the tab.
    expect(replace).toHaveBeenCalledWith("/admin/sponsors/42?tab=contacts", { scroll: false });
  });
});

describe("Sponsor sheet — a save that never left says so (#428)", () => {
  it("reports an error when the request does not reach the backend", async () => {
    const user = userEvent.setup();
    // What `adminFetch` returns when fetch itself throws: no answer, no body.
    // The screen used to test `status >= 400`, which 0 does not satisfy, so a
    // dropped connection displayed "Modifications enregistrées."
    adminFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return Promise.resolve({ data: null, status: 0 });
      if (path === "/sponsor-tiers") return Promise.resolve({ data: TIERS, status: 200 });
      if (path === "/sponsors/42") return Promise.resolve({ data: SPONSOR, status: 200 });
      return Promise.resolve({ data: [], status: 200 });
    });

    render(<SponsorEditorPage />);
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Échec de l'enregistrement. Réessayez.")).toBeInTheDocument();
    expect(screen.queryByText("Modifications enregistrées.")).not.toBeInTheDocument();
  });

  it("still confirms a save that did reach the backend", async () => {
    const user = userEvent.setup();
    render(<SponsorEditorPage />);
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Modifications enregistrées.")).toBeInTheDocument();
  });
});

describe("Sponsor sheet — a blocked save explains itself (#393)", () => {
  it("says which field is missing and where it lives", async () => {
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    const name = await screen.findByLabelText("Nom *");
    await user.clear(name);

    // A greyed-out button with no explanation left the editor guessing —
    // worse once the blocking field sits on a tab that is not open.
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByText("Renseignez le nom, onglet Identité.")).toBeInTheDocument();
    });
    expect(name).toHaveAttribute("aria-invalid", "true");
  });
});


// #429 â the sheet opened on the most recent participation and stayed there.
// A company attached to 2026 and 2025 had no way to reach its 2025 tier, logo
// or com kit: the very fields #375 froze per year, so there was nowhere to
// correct them.

const MULTI_YEAR = {
  ...SPONSOR,
  editionId: 1,
  edition: { id: 1, year: 2026 },
  tierId: 1,
  editions: [
    {
      editionId: 1,
      edition: { id: 1, year: 2026 },
      tier: TIERS[0],
      publicationStatus: "PUBLISHED",
      logoUrl: "/logos/2026.svg",
      comKitNotes: "Notes 2026",
    },
    {
      editionId: 2,
      edition: { id: 2, year: 2025 },
      tier: TIERS[1],
      publicationStatus: "DRAFT",
      logoUrl: "/logos/2025.svg",
      comKitNotes: "Notes 2025",
    },
  ],
};

function mockMultiYear() {
  adminFetch.mockImplementation((path: string) => {
    if (path === "/sponsor-tiers") return Promise.resolve({ data: TIERS, status: 200 });
    if (path === "/sponsors/42") return Promise.resolve({ data: MULTI_YEAR, status: 200 });
    if (path === "/editions") return Promise.resolve({ data: [{ id: 1, year: 2026 }, { id: 2, year: 2025 }], status: 200 });
    return Promise.resolve({ data: [], status: 200 });
  });
}

describe("Sponsor sheet â reaching a past participation (#429)", () => {
  it("offers the years the company took part in", async () => {
    mockMultiYear();
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    // The picker lives in the year-scoped panels, not on Identité — that tab
    // edits the company, every year.
    await user.click(await screen.findByRole("tab", { name: "Participation 2026" }));

    const picker = await screen.findByLabelText(/Année éditée/);
    expect([...(picker as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["2026", "2025"]);
  });

  it("swaps every year-scoped field when the year changes", async () => {
    mockMultiYear();
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "Participation 2026" }));
    await user.selectOptions(await screen.findByLabelText(/Année éditée/), "2");

    // The tier of 2025, not the one of 2026 â a field left behind would be
    // written onto 2025 by the next save, undoing the freeze of #375.
    expect(await screen.findByRole("tab", { name: "Participation 2025" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Niveau 2025/)).toHaveValue("2");
  });

  it("shows no picker when there is only one year to edit", async () => {
    const user = userEvent.setup();
    render(<SponsorEditorPage />);

    // The single-participation payload of the other tests: a select with one
    // option is furniture, and the year is already in the tab label.
    await user.click(await screen.findByRole("tab", { name: "Participation 2025" }));
    expect(screen.queryByLabelText(/Année éditée/)).not.toBeInTheDocument();
  });
});
