import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the router and query params — the page reads both at module load.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// adminFetch is the seam: the list load and the DELETE both go through it.
const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: SpeakersDataPage } = await import("./page");

const speaker = {
  id: 7,
  name: "Ada Lovelace",
  company: "Analytical Engine",
  publicationStatus: "PUBLISHED",
  isFeatured: false,
  edition: { id: 1, year: 2026 },
};

beforeEach(() => {
  adminFetch.mockReset();
  // Default: the initial list load returns our one speaker.
  adminFetch.mockResolvedValue({ data: [speaker], status: 200 });
});

// #300: the speakers list had no delete button — DataTable only got onEdit.
// These lock the wiring: the button opens a danger dialog, confirming issues a
// DELETE and drops the row; cancelling does neither.
describe("SpeakersDataPage delete (#300)", () => {
  it("deletes a speaker through a confirm dialog", async () => {
    const user = userEvent.setup();
    render(<SpeakersDataPage />);

    // Wait for the row to appear (list loaded).
    await screen.findByText("Ada Lovelace");

    // The delete button exists (the bug was that it did not).
    await user.click(screen.getByRole("button", { name: "Supprimer" }));

    // A danger confirm dialog names the speaker.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Ada Lovelace");

    // The backend soft-deletes and answers 204 — the handler must accept 204.
    // Confirm from inside the dialog: the row's own "Supprimer" is still in the
    // DOM, so scope the click to the dialog to avoid an ambiguous match.
    adminFetch.mockResolvedValueOnce({ status: 204 });
    await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(adminFetch).toHaveBeenCalledWith("/speakers/7", { method: "DELETE" });
    });
    // Row is gone from the list.
    await waitFor(() => {
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    });
  });

  it("does not call DELETE when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    // Only the initial list load happened — no DELETE.
    expect(adminFetch).not.toHaveBeenCalledWith("/speakers/7", { method: "DELETE" });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("surfaces a backend error instead of dropping the row silently", async () => {
    const user = userEvent.setup();
    render(<SpeakersDataPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    const dialog = await screen.findByRole("dialog");

    // A 409 (or any non-204) must show a message and keep the row.
    adminFetch.mockResolvedValueOnce({ status: 409, error: "Conflit." });
    await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await screen.findByRole("alert");
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });
});
