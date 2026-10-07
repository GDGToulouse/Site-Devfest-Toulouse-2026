import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #567 — the recap goes out only on an admin's click, after a confirmation
// that says who it reaches, and reports who did not get it.

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (_result: unknown, fallback: string) => fallback,
}));

const { default: FeedbackRecap } = await import("./FeedbackRecap");

let preview: { phase: string; speakers: number; withoutEmail: string[]; lastSentAt: string | null };
let report: { sent: string[]; withoutEmail: string[]; failed: string[] };

beforeEach(() => {
  preview = { phase: "closed", speakers: 3, withoutEmail: ["Carl"], lastSentAt: null };
  report = { sent: ["Ada", "Bob"], withoutEmail: ["Carl"], failed: [] };
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (_path: string, options?: { method?: string }) =>
    options?.method === "POST" ? { status: 200, data: report } : { status: 200, data: preview },
  );
});

const posts = () => adminFetch.mock.calls.filter(([, options]) => options?.method === "POST");

describe("FeedbackRecap (#567)", () => {
  it("should say who has feedback and who cannot be reached", async () => {
    render(<FeedbackRecap editionId={1} />);

    expect(await screen.findByText(/3 speakers avec des avis, dont 2 joignables par e-mail/)).toBeInTheDocument();
    expect(screen.getByText("Sans adresse de contact : Carl.")).toBeInTheDocument();
  });

  it("should send only once the admin confirms", async () => {
    render(<FeedbackRecap editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer le récapitulatif aux speakers" }));

    expect(posts()).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("2 speakers vont recevoir un e-mail.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Envoyer" }));

    expect(posts()).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Récapitulatif envoyé à 2 speakers.");
  });

  it("should warn that votes still open will miss this send", async () => {
    preview = { ...preview, phase: "open" };
    render(<FeedbackRecap editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer le récapitulatif aux speakers" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Les avis sont encore ouverts");
  });

  it("should keep a failed send visible and name who missed it", async () => {
    report = { sent: ["Ada"], withoutEmail: [], failed: ["Bob"] };
    render(<FeedbackRecap editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer le récapitulatif aux speakers" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("1 en échec");
    expect(screen.getByText("En échec : Bob.")).toBeInTheDocument();
  });

  it("should offer no send while nobody can be reached", async () => {
    preview = { phase: "open", speakers: 0, withoutEmail: [], lastSentAt: null };
    render(<FeedbackRecap editionId={1} />);

    expect(await screen.findByRole("button", { name: "Envoyer le récapitulatif aux speakers" })).toBeDisabled();
  });
});
