import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #111 — the team writes the FAQ theme by theme and reorders it with arrows.

vi.mock("@/components/admin/RichTextEditor", () => ({ default: () => null }));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (_r: unknown, fallback: string) => fallback,
}));

const { default: FaqAdminPage } = await import("./page");

const item = (id: number, theme: string, questionFr: string, extra: Record<string, unknown> = {}) => ({
  id,
  theme,
  questionFr,
  questionEn: "Q",
  answerFr: "",
  answerEn: "",
  publicationStatus: "PUBLISHED",
  ...extra,
});

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method) return { status: path === "/faq" ? 201 : 200, data: {} };
    return {
      status: 200,
      data: [item(1, "VENUE", "Où ?"), item(2, "VENUE", "Comment venir ?", { questionEn: "", publicationStatus: "DRAFT" }), item(3, "OTHER", "Contact ?")],
    };
  });
});

describe("FaqAdminPage (#111)", () => {
  it("should group the questions by theme and flag drafts and missing translations", async () => {
    render(<FaqAdminPage />);

    expect(await screen.findByRole("heading", { name: "Lieu et accès" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Autres questions" })).toBeInTheDocument();
    expect(screen.getByText("Comment venir ?").closest("li")).toHaveTextContent("Brouillon");
    expect(screen.getByText("Comment venir ?").closest("li")).toHaveTextContent("sans traduction");
  });

  it("should move a question down within its theme and save the new order", async () => {
    render(<FaqAdminPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Descendre « Où ? »" }));

    await waitFor(() =>
      expect(adminFetch).toHaveBeenCalledWith("/faq/order", { method: "PUT", body: JSON.stringify({ ids: [2, 1, 3] }) }),
    );
  });

  it("should refuse a question without its French wording", async () => {
    render(<FaqAdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "+ Ajouter une question" }));

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("La question en français est obligatoire.")).toBeInTheDocument();
    expect(adminFetch).not.toHaveBeenCalledWith("/faq", expect.objectContaining({ method: "POST" }));
  });
});
