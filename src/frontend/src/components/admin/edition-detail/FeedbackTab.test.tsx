import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #566 — the feedback test mode is switched on before the event day, and off
// only after a confirmation that says how many test votes go with it.

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (result: { data?: { message?: string } }, fallback: string) => result.data?.message ?? fallback,
}));

const { default: FeedbackTab } = await import("./FeedbackTab");

let state: { enabled: boolean; canEnable: boolean; opensAt: string | null; testVotes: number };

beforeEach(() => {
  state = { enabled: false, canEnable: true, opensAt: "2026-11-18T23:00:00.000Z", testVotes: 0 };
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (_path: string, options?: { method?: string; body?: string }) => {
    if (options?.method === "PUT") {
      const { enabled } = JSON.parse(options.body!);
      const deleted = enabled ? 0 : state.testVotes;
      state = { ...state, enabled, testVotes: enabled ? state.testVotes : 0 };
      return { status: 200, data: { enabled, deleted } };
    }
    return { status: 200, data: state };
  });
});

function puts() {
  return adminFetch.mock.calls.filter(([, options]) => options?.method === "PUT").map(([, options]) => JSON.parse(options.body));
}

describe("FeedbackTab — test mode (#566)", () => {
  it("should switch the test mode on", async () => {
    render(<FeedbackTab editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Activer le mode test" }));

    expect(puts()).toEqual([{ enabled: true }]);
    expect(await screen.findByRole("status")).toHaveTextContent("Mode test activé");
  });

  it("should switch it off only after a confirmation naming the test votes", async () => {
    state = { ...state, enabled: true, testVotes: 3 };
    render(<FeedbackTab editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Désactiver et supprimer les avis de test" }));

    expect(puts()).toEqual([]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Les 3 avis de test");
    await userEvent.click(within(dialog).getByRole("button", { name: "Désactiver et supprimer" }));

    expect(puts()).toEqual([{ enabled: false }]);
    expect(await screen.findByRole("status")).toHaveTextContent("3 avis de test supprimés");
  });

  it("should offer no switch once the event day has come", async () => {
    state = { ...state, canEnable: false };
    render(<FeedbackTab editionId={1} />);

    expect(await screen.findByText(/n’est plus disponible/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activer le mode test" })).not.toBeInTheDocument();
  });

  it("should tell an editor the feedback is for administrators", async () => {
    adminFetch.mockResolvedValue({ status: 403, data: null });
    render(<FeedbackTab editionId={1} />);

    expect(await screen.findByText("Les avis du public sont réservés aux administrateurs.")).toBeInTheDocument();
  });
});
