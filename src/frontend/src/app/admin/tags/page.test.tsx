import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #376 — renaming a tag onto a name another tag holds is almost always a
// duplicate to merge: the screen offers the merge instead of a dead end.
const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (_r: unknown, fallback: string) => fallback,
}));

const { default: TagsAdminPage } = await import("./page");

const TAGS = [
  { id: 1, name: "logo", slug: "logo", articleCount: 2 },
  { id: 2, name: "Logos", slug: "logos", articleCount: 5 },
];

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === "PUT")
      return { data: null, status: 409, errorBody: { error: "tag_exists", existingId: 2, existingName: "Logos" } };
    if (options?.method === "POST") return { data: { merged: true }, status: 200 };
    return { data: TAGS, status: 200 };
  });
});

describe("Admin tags (#376)", () => {
  it("turns a rename onto a taken name into a merge into that tag", async () => {
    render(<TagsAdminPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Renommer logo" }));
    const input = screen.getByLabelText("Nouveau nom pour logo");
    await userEvent.clear(input);
    await userEvent.type(input, "Logos{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "Préparer la fusion" }));
    await userEvent.click(screen.getByRole("button", { name: "Fusionner" }));

    await waitFor(() =>
      expect(adminFetch).toHaveBeenCalledWith("/tags/1/merge", { method: "POST", body: JSON.stringify({ targetId: 2 }) }),
    );
  });

  it("says how many articles lose a tag before it is removed", async () => {
    render(<TagsAdminPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Supprimer Logos" }));

    expect(screen.getByText(/5 articles ne l'afficheront plus/)).toBeInTheDocument();
  });
});
