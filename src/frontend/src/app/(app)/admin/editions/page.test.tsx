import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #415 — typing a year then Enter, the reflex on a single field, created
// nothing: there was no form to submit.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: EditionsAdminPage } = await import("./page");

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === "POST") return { data: { id: 9, year: 2027 }, status: 201 };
    if (path === "/editions/featured") return { data: { editionId: null }, status: 200 };
    return { data: [], status: 200 };
  });
});

describe("Admin editions (#415)", () => {
  it("creates an edition when Enter is pressed in the year field", async () => {
    render(<EditionsAdminPage />);

    await userEvent.type(await screen.findByLabelText("Année de la nouvelle édition"), "2027{Enter}");

    await waitFor(() =>
      expect(adminFetch).toHaveBeenCalledWith("/editions", expect.objectContaining({ method: "POST" })),
    );
  });

  it("says so when there is no edition yet", async () => {
    render(<EditionsAdminPage />);

    expect(await screen.findByText(/Aucune édition/)).toBeInTheDocument();
  });
});
