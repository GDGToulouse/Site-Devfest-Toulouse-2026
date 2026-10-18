import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #416 — the articles list moves to the shared pagination, the page kept in the
// URL. Deleting the last article of a page used to reload that page, now empty,
// and read "Aucun article" while earlier pages still held some.
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/admin/articles",
  useSearchParams: () => searchParams,
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: ArticlesListPage } = await import("./page");

const article = {
  id: 41,
  slug: "dernier",
  titleFr: "Le dernier de la page",
  publicationStatus: "DRAFT",
  author: null,
  publishedAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  tags: [],
  editions: [],
};

beforeEach(() => {
  replace.mockReset();
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === "DELETE") return { data: null, status: 204 };
    return { data: { articles: [article], total: 21, page: 2, totalPages: 2 }, status: 200 };
  });
});

describe("Admin articles list (#416)", () => {
  it("asks the API for the page in the URL", async () => {
    searchParams = new URLSearchParams("page=2");
    render(<ArticlesListPage />);

    await screen.findByText("Le dernier de la page");

    expect(adminFetch).toHaveBeenCalledWith("/articles?page=2&limit=20");
    expect(screen.getByText("21–21 sur 21")).toBeInTheDocument();
  });

  it("steps back a page when the last article of a page is deleted", async () => {
    searchParams = new URLSearchParams("page=2");
    render(<ArticlesListPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Supprimer" }).at(-1)!);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/articles?page=1", { scroll: false }));
  });
});
