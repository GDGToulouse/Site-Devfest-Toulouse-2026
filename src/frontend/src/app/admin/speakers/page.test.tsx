import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The URL holds the list state since #572: the router and the query params are
// the seam, and `replace` is how a filter change reaches them.
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/admin/speakers",
  useSearchParams: () => searchParams,
}));

// adminFetch is the seam: the editions, the list page and the DELETE go through it.
const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: SpeakersDataPage } = await import("./page");

const row = (over: Record<string, unknown>) => ({
  company: null,
  talkCount: 0,
  status: null,
  hasPhoto: true,
  hasBio: true,
  hasEmail: true,
  editLink: "sent",
  editions: [{ id: 1, year: 2026, isFeatured: false, publicationStatus: "PUBLISHED" }],
  ...over,
});

// #351: the editorial state hangs off the participations, not the person.
const ada = row({ id: 7, name: "Ada Lovelace", company: "Analytical Engine" });
let items: unknown[] = [ada];

beforeEach(() => {
  replace.mockReset();
  searchParams = new URLSearchParams();
  items = [ada];
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === "DELETE") return { status: 204 };
    if (path === "/editions") return { status: 200, data: [{ id: 1, year: 2026 }, { id: 2, year: 2025 }] };
    return { status: 200, data: { page: 1, limit: 50, total: items.length, items } };
  });
});

const listCalls = () => adminFetch.mock.calls.map(([path]) => path as string).filter((p) => p.startsWith("/speakers?"));

// #300: the speakers list had no delete button — DataTable only got onEdit.
describe("SpeakersDataPage delete (#300)", () => {
  it("deletes a speaker through a confirm dialog and reloads the page", async () => {
    const user = userEvent.setup();
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Supprimer Ada Lovelace" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Ada Lovelace");

    // Scope the click to the dialog: the row's own "Supprimer" is still in the DOM.
    items = [];
    await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledWith("/speakers/7", { method: "DELETE" }));
    await waitFor(() => expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument());
  });

  it("does not call DELETE when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Supprimer Ada Lovelace" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(adminFetch).not.toHaveBeenCalledWith("/speakers/7", { method: "DELETE" });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("surfaces a backend error instead of dropping the row silently", async () => {
    const user = userEvent.setup();
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Supprimer Ada Lovelace" }));
    const dialog = await screen.findByRole("dialog");
    adminFetch.mockResolvedValueOnce({ status: 409, error: "Conflit." });
    await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await screen.findByRole("alert");
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("shows every edition of a multi-edition speaker on a single row (#351)", async () => {
    items = [
      row({
        id: 9,
        name: "Grace Hopper",
        editions: [
          { id: 2, year: 2025, isFeatured: false, publicationStatus: "PUBLISHED" },
          { id: 1, year: 2019, isFeatured: false, publicationStatus: "PUBLISHED" },
        ],
      }),
    ];
    render(<SpeakersDataPage />);

    expect(await screen.findAllByText("Grace Hopper")).toHaveLength(1);
    expect(screen.getByText("2025, 2019")).toBeInTheDocument();
  });
});

describe("SpeakersDataPage filters (#572)", () => {
  it("should ask the API for one page with the filters held in the URL", async () => {
    searchParams = new URLSearchParams("year=2026&status=DRAFT&missing=email&page=2");
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    const sent = new URLSearchParams(listCalls().at(-1)!.split("?")[1]);
    expect(Object.fromEntries(sent)).toEqual({ page: "2", limit: "50", editionId: "1", status: "DRAFT", missing: "email" });
  });

  it("should write a filter to the URL and go back to the first page", async () => {
    searchParams = new URLSearchParams("year=2026&page=3");
    const user = userEvent.setup();
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    await user.selectOptions(screen.getByRole("combobox", { name: "Sessions" }), "without");

    expect(replace).toHaveBeenCalledWith("/admin/speakers?year=2026&talks=without", { scroll: false });
  });

  it("should keep status and talks off until an edition is chosen", async () => {
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    expect(screen.getByRole("combobox", { name: "Statut" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Sessions" })).toBeDisabled();
  });

  it("should flag the gaps of a profile and the state of its edit link", async () => {
    items = [row({ id: 3, name: "Bob", hasPhoto: false, hasEmail: false, editLink: "never" })];
    render(<SpeakersDataPage />);

    expect(await screen.findByText("Sans photo, e-mail")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Jamais envoyé" })).toBeInTheDocument();
  });
});
