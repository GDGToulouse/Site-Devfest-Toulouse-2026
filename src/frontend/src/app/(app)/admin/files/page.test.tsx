import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// #768 — the library's text search lives in the URL with the other filters, is
// sent to the API as `q` / `in`, starts again from page 1, and says when it
// finds nothing.
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/admin/files",
  useSearchParams: () => searchParams,
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: FilesAdminPage } = await import("./page");

const EMPTY = { page: 1, limit: 48, total: 0, counts: { all: 0, images: 0, documents: 0, unused: 0 }, items: [] };

beforeEach(() => {
  replace.mockReset();
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string) => ({ data: path === "/file-tags" ? [] : EMPTY, status: 200 }));
});

describe("Admin files search (#768)", () => {
  it("sends the search in the URL to the API, with the ticked fields", async () => {
    searchParams = new URLSearchParams("q=diagora&in=alt&type=images");
    render(<FilesAdminPage />);

    await waitFor(() =>
      expect(adminFetch).toHaveBeenCalledWith("/files?page=1&limit=48&q=diagora&in=name%2Cusages%2Calt&type=images"),
    );
    expect(screen.getByRole("checkbox", { name: "Texte alternatif" })).toBeChecked();
  });

  it("puts a typed search in the URL and goes back to page 1", async () => {
    searchParams = new URLSearchParams("page=3&type=images");
    render(<FilesAdminPage />);

    fireEvent.change(await screen.findByRole("searchbox", { name: "Rechercher un fichier" }), {
      target: { value: "logo" },
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/files?type=images&q=logo", { scroll: false }));
  });

  it("says a search found nothing, rather than showing an empty grid", async () => {
    searchParams = new URLSearchParams("q=introuvable");
    render(<FilesAdminPage />);

    expect(await screen.findByRole("status")).toHaveTextContent("Aucun fichier ne correspond à « introuvable »");
  });

  it("does not suggest ticking boxes that are already ticked", async () => {
    searchParams = new URLSearchParams("q=introuvable&in=name,usages,alt,tags");
    render(<FilesAdminPage />);

    expect(await screen.findByRole("status")).not.toHaveTextContent("cochez");
  });
});
