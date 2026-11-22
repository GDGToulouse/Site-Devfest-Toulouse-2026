import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #567 — the recap goes out only on an admin's click, after a confirmation
// that says who it reaches. #865 — where it stands is shown per speaker, the
// main button only writes to those not served yet, a line sends its own.

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (_result: unknown, fallback: string) => fallback,
}));

const { default: FeedbackRecap } = await import("./FeedbackRecap");

interface Speaker {
  id: number;
  name: string;
  email: string | null;
  sentAt: string | null;
  failedAt: string | null;
}

const ADA: Speaker = { id: 1, name: "Ada", email: "ada@example.com", sentAt: "2026-11-20T09:00:00.000Z", failedAt: null };
const BOB: Speaker = { id: 2, name: "Bob", email: "bob@example.com", sentAt: null, failedAt: "2026-11-20T09:00:00.000Z" };
const CARL: Speaker = { id: 3, name: "Carl", email: null, sentAt: null, failedAt: null };
const DORA: Speaker = { id: 4, name: "Dora", email: "dora@example.com", sentAt: null, failedAt: null };

let overview: { phase: string; speakers: Speaker[] };
let report: { sent: string[]; withoutEmail: string[]; failed: string[] };

beforeEach(() => {
  overview = { phase: "closed", speakers: [ADA, BOB, CARL, DORA] };
  report = { sent: ["Bob", "Dora"], withoutEmail: ["Carl"], failed: [] };
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (_path: string, options?: { method?: string }) =>
    options?.method === "POST" ? { status: 200, data: report } : { status: 200, data: overview },
  );
});

const posts = () => adminFetch.mock.calls.filter(([, options]) => options?.method === "POST").map(([path]) => path);
const rows = () => screen.getAllByRole("row").slice(1);

describe("FeedbackRecap (#567, #865)", () => {
  it("should show each speaker's state, those without an address first", async () => {
    render(<FeedbackRecap editionId={1} />);
    await screen.findByRole("table");

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Carl—Sans adresse/),
      expect.stringMatching(/^Bobbob@example\.comÉchec le/),
      expect.stringMatching(/^Doradora@example\.comÀ envoyer/),
      expect.stringMatching(/^Adaada@example\.comEnvoyé le/),
    ]);
    expect(within(rows()[0]).getByRole("link", { name: "Carl" })).toHaveAttribute("href", "/admin/speakers/3");
  });

  it("should send to the speakers not served yet, once the admin confirms", async () => {
    render(<FeedbackRecap editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer aux 2 speakers pas encore servis" }));

    expect(posts()).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("2 speakers vont recevoir un e-mail : Bob, Dora.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Envoyer" }));

    expect(posts()).toEqual(["/editions/1/feedback-recap"]);
    expect(await screen.findByRole("status")).toHaveTextContent("Récapitulatif envoyé à Bob, Dora.");
  });

  it("should send one speaker their recap again from their line", async () => {
    report = { sent: ["Ada"], withoutEmail: [], failed: [] };
    render(<FeedbackRecap editionId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: "Renvoyer le récapitulatif à Ada" }));

    expect(posts()).toEqual(["/editions/1/feedback-recap/1"]);
  });

  it("should warn that votes still open will miss this send", async () => {
    overview = { ...overview, phase: "open" };
    render(<FeedbackRecap editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: /pas encore servis/ }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Les avis sont encore ouverts");
  });

  it("should keep a failed send visible and name who missed it", async () => {
    report = { sent: ["Dora"], withoutEmail: [], failed: ["Bob"] };
    render(<FeedbackRecap editionId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: /pas encore servis/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("En échec : Bob.");
  });

  it("should offer no send once every reachable speaker has it", async () => {
    overview = { phase: "closed", speakers: [ADA, CARL] };
    render(<FeedbackRecap editionId={1} />);

    expect(await screen.findByRole("button", { name: "Tous les speakers joignables l'ont reçu" })).toBeDisabled();
  });

  it("should not claim the recap went out when no speaker can be reached", async () => {
    overview = { phase: "closed", speakers: [CARL] };
    render(<FeedbackRecap editionId={1} />);

    expect(await screen.findByRole("button", { name: "Aucun speaker joignable par e-mail" })).toBeDisabled();
  });
});
