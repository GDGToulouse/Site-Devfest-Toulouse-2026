import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SpeakerFeedback, { type SpeakerFeedbackLabels } from "./SpeakerFeedback";

// #565 — the speaker reads their sessions' feedback on their edit link: every
// appreciation with its share, and the messages left to them.

const LABELS: SpeakerFeedbackLabels = {
  heading: "Retours du public",
  intro: "",
  votes: (n) => `${n} avis`,
  messages: "Messages",
  noMessage: "Aucun message pour l'instant.",
  test: "mode test, sera effacé",
};

let body: unknown;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SpeakerFeedback (#565)", () => {
  it("should show each appreciation with its share, and the messages", async () => {
    body = {
      talks: [
        {
          id: 7,
          title: "Mesurer l'avis",
          year: 2026,
          votes: 4,
          testVotes: 0,
          items: [
            { code: "learned", count: 3 },
            { code: "tooComplex", count: 1 },
          ],
          messages: [{ text: "Très clair, merci", at: "2026-11-19T15:00:00.000Z", isTest: false }],
        },
      ],
    };
    render(<SpeakerFeedback token="t" locale="fr" labels={LABELS} />);

    expect(await screen.findByRole("heading", { name: "Mesurer l'avis" })).toBeInTheDocument();
    expect(screen.getByText("4 avis")).toBeInTheDocument();
    expect(screen.getByText("J'ai beaucoup appris 🤓").closest("li")).toHaveTextContent("3 (75 %)");
    expect(screen.getByText("Trop complexe 🤯").closest("li")).toHaveTextContent("1 (25 %)");
    expect(screen.getByText("Très clair, merci")).toBeInTheDocument();
  });

  it("should stay out of the way before the first vote", async () => {
    body = { talks: [] };
    const { container } = render(<SpeakerFeedback token="t" locale="fr" labels={LABELS} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container).toBeEmptyDOMElement();
  });

  it("should label the appreciations in English for an English-speaking speaker", async () => {
    body = { talks: [{ id: 7, title: "T", year: 2026, votes: 1, testVotes: 0, items: [{ code: "fun", count: 1 }], messages: [] }] };
    render(<SpeakerFeedback token="t" locale="en" labels={LABELS} />);

    expect(await screen.findByText("Fun 😃")).toBeInTheDocument();
  });
});
