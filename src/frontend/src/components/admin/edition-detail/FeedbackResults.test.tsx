import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #565 — the team sees every session's feedback, negatives included, opens
// one to read its messages and hides one that is out of place.

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (_result: unknown, fallback: string) => fallback,
}));

const { default: FeedbackResults } = await import("./FeedbackResults");

const ITEMS = [
  { code: "learned", count: 3 },
  { code: "notClear", count: 2 },
];
let hidden = false;

beforeEach(() => {
  hidden = false;
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
    if (options?.method === "PUT") {
      hidden = JSON.parse(options.body!).hidden;
      return { status: 200, data: {} };
    }
    if (path === "/editions/1/feedback") {
      return {
        status: 200,
        data: {
          talks: [
            { id: 7, title: "Mesurer l'avis", slug: "m", speakers: ["Ada"], votes: 4, testVotes: 0, items: ITEMS, messages: 1 },
            { id: 8, title: "Sans avis", slug: "s", speakers: [], votes: 0, testVotes: 0, items: [], messages: 0 },
          ],
        },
      };
    }
    return {
      status: 200,
      data: { id: 7, title: "Mesurer l'avis", votes: 4, items: ITEMS, messages: [{ id: 42, text: "Message déplacé", at: null, hidden, isTest: false }] },
    };
  });
});

describe("FeedbackResults (#565)", () => {
  it("should list the voted sessions with their most ticked appreciations, negatives included", async () => {
    render(<FeedbackResults editionId={1} />);
    const row = await screen.findByRole("button", { name: /Mesurer l'avis/ });

    expect(row).toHaveTextContent("J'ai beaucoup appris 🤓 75 %");
    expect(row).toHaveTextContent("Pas clair 🧐 50 %");
    expect(screen.queryByText("Sans avis")).not.toBeInTheDocument();
  });

  it("should hide a message and say the speaker will not see it", async () => {
    render(<FeedbackResults editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: /Mesurer l'avis/ }));
    const message = (await screen.findByText("Message déplacé")).closest("li") as HTMLElement;
    await userEvent.click(within(message).getByRole("button", { name: "Masquer" }));

    expect(hidden).toBe(true);
    expect(await screen.findByRole("status")).toHaveTextContent("le speaker ne le verra pas");
    expect(await screen.findByRole("button", { name: "Réafficher" })).toBeInTheDocument();
  });
});
