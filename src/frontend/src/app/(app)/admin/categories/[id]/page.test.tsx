import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #415 — saving a category threw the editor back to the list, unlike the
// talks, speakers and sponsors sheets, which stay and say it worked.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "4" }),
  useSearchParams: () => new URLSearchParams(),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: CategoryEditorPage } = await import("./page");

beforeEach(() => {
  push.mockReset();
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === "PUT") return { data: { id: 4 }, status: 200 };
    if (path === "/categories/4")
      return { data: { id: 4, nameFr: "Web", nameEn: "Web", color: "#EC6839", editions: [] }, status: 200 };
    return { data: [], status: 200 };
  });
});

describe("Category editor (#415)", () => {
  it("stays on the sheet after saving and confirms it", async () => {
    render(<CategoryEditorPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Modifications enregistrées.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
