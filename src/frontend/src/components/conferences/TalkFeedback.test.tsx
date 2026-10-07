import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import TalkFeedback, { FEEDBACK_ITEMS } from "./TalkFeedback";

// #564 — the audience votes on the talk page, once, then may leave the speaker
// a private message. Nothing shows before the event day; the trend waits for
// one's own vote, or for voting to be over.

type Status = { phase: string; hasVoted: boolean; hasMessage: boolean; trend: { code: string; percent: number }[] | null };

let status: Status;
const posts: { url: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  localStorage.clear();
  posts.length = 0;
  status = { phase: "open", hasVoted: false, hasMessage: false, trend: null };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        if (!url.endsWith("/message")) status = { ...status, hasVoted: true, trend: [{ code: "learned", percent: 80 }] };
        return new Response(null, { status: 201 });
      }
      return Response.json(status);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderBlock() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <TalkFeedback slug="mon-talk" />
    </NextIntlClientProvider>,
  );
}

describe("TalkFeedback (#564)", () => {
  it("should render nothing before the event day", async () => {
    status = { phase: "upcoming", hasVoted: false, hasMessage: false, trend: null };
    const { container } = renderBlock();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container).toBeEmptyDOMElement();
  });

  it("should send the ticked appreciations with this browser's voter id", async () => {
    renderBlock();
    await userEvent.click(await screen.findByRole("button", { name: "J'ai beaucoup appris 🤓" }));
    await userEvent.click(screen.getByRole("button", { name: "Pas clair 🧐" }));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer mon avis" }));

    expect(posts[0].url).toBe("/api/talks/mon-talk/feedback");
    expect(posts[0].body).toEqual({ voterId: localStorage.getItem("devfest-feedback-voter"), items: ["learned", "notClear"] });
  });

  it("should not let an empty vote be sent", async () => {
    renderBlock();

    expect(await screen.findByRole("button", { name: "Envoyer mon avis" })).toBeDisabled();
  });

  it("should thank, invite a private message and show the trend once voted", async () => {
    renderBlock();
    await userEvent.click(await screen.findByRole("button", { name: "Super intéressant 👍" }));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer mon avis" }));

    expect(await screen.findByRole("heading", { name: "Merci pour votre avis !" })).toBeInTheDocument();
    expect(screen.getByLabelText("Un mot pour le speaker ?")).toBeInTheDocument();
    expect(screen.getByText(/80 %/)).toBeInTheDocument();
  });

  it("should send the private message and confirm it", async () => {
    status = { phase: "open", hasVoted: true, hasMessage: false, trend: null };
    renderBlock();
    await userEvent.type(await screen.findByLabelText("Un mot pour le speaker ?"), "Merci !");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer le message" }));

    expect(posts[0]).toMatchObject({ url: "/api/talks/mon-talk/feedback/message", body: { message: "Merci !" } });
    expect(await screen.findByRole("status")).toHaveTextContent("Votre message a bien été transmis.");
  });

  it("should show only the trend once voting is over", async () => {
    status = { phase: "closed", hasVoted: false, hasMessage: false, trend: [{ code: "fun", percent: 60 }] };
    renderBlock();

    expect(await screen.findByRole("heading", { name: "Ce que le public en a pensé" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Envoyer mon avis" })).not.toBeInTheDocument();
  });

  it("should credit OpenFeedback and OpenPlanner with links", async () => {
    renderBlock();

    expect(await screen.findByRole("link", { name: "OpenFeedback" })).toHaveAttribute("href", "https://github.com/HugoGresse/open-feedback");
    expect(screen.getByRole("link", { name: "OpenPlanner" })).toHaveAttribute("href", "https://openplanner.fr/features");
    // A straight apostrophe right before a tag is an ICU escape: it swallowed
    // the link and the apostrophe of "d'Hugo". The sentence must read in full.
    expect(screen.getByText(/Inspiré d’/).textContent).toBe(
      "Inspiré d’OpenFeedback d’Hugo Gresse (aussi dispo en version hébergée sur OpenPlanner).",
    );
  });
});

describe("TalkFeedback — translations", () => {
  const keys = ["title", "intro", "send", "sending", "thanks", "messageLabel", "messageHint", "sendMessage", "messageSent", "trendTitle", "trendPending", "voteError", "messageError", "closedError", "credit"] as const;

  it.each(keys)("should resolve feedback.%s in French and English", (key) => {
    expect(fr.feedback[key]).toBeTruthy();
    expect(en.feedback[key]).toBeTruthy();
  });

  it.each(FEEDBACK_ITEMS)("should resolve feedback.items.%s in French and English", (code) => {
    expect(fr.feedback.items[code]).toBeTruthy();
    expect(en.feedback.items[code]).toBeTruthy();
  });
});
