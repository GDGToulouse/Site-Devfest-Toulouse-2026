import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ReplayCard from "./ReplayCard";
import type { Replay } from "@/lib/types";

// next-intl's <Link> needs the router context; the card only ever renders plain
// anchors, so a passthrough keeps the assertions about hrefs honest.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// #344 — the card links to the talk, its tags narrow the list, and the language
// shows up. The filter links are what these lock: clicking a tag must keep the
// other active filters instead of resetting the view.
const replay: Replay = {
  slug: "un-talk",
  title: "Un talk mémorable",
  format: "CONFERENCE",
  language: "en",
  videoUrl: "https://www.youtube.com/watch?v=abc",
  year: 2019,
  category: { nameFr: "Langages de programmation", nameEn: "Languages", color: "#109E6E" },
  speakers: [{ slug: "ada", name: "Ada Lovelace", photoUrl: null }],
};

const labels = {
  watch: "Revoir",
  filterBy: "Filtrer sur {value}",
  languageLabels: { fr: "Français", en: "Anglais" },
  formatLabels: { CONFERENCE: "Conférence", QUICKIE: "Quickie", KEYNOTE: "Keynote", WORKSHOP: "Workshop" },
};

const noFilter = { q: "", year: "", format: "", category: "" };

function renderCard(current = noFilter) {
  render(<ReplayCard replay={replay} locale="fr" current={current} labels={labels} />);
}

const hrefOf = (name: string | RegExp) =>
  screen.getByRole("link", { name }).getAttribute("href");

describe("ReplayCard", () => {
  it("should link the title to the year-scoped talk page", () => {
    renderCard();
    expect(hrefOf("Un talk mémorable")).toBe("/editions/2019/conferences/un-talk");
  });

  it("should show the spoken language", () => {
    renderCard();
    expect(screen.getByText("Anglais")).toBeInTheDocument();
  });

  it("should turn the year, format and category into filter links", () => {
    renderCard();
    expect(hrefOf("2019")).toBe("/replays?year=2019");
    expect(hrefOf("Conférence")).toBe("/replays?format=CONFERENCE");
    // URLSearchParams encodes spaces as `+`, which the backend decodes the same
    // way as %20 — verified against the live API.
    expect(hrefOf("Langages de programmation")).toBe(
      "/replays?category=Langages+de+programmation",
    );
  });

  // The whole point of passing `current` down: narrowing, not resetting.
  it("should keep the other active filters when a tag is clicked", () => {
    renderCard({ q: "rust", year: "", format: "CONFERENCE", category: "" });
    const href = hrefOf("2019")!;
    expect(href).toContain("year=2019");
    expect(href).toContain("q=rust");
    expect(href).toContain("format=CONFERENCE");
  });

  it("should replace the value of the tag being clicked", () => {
    renderCard({ q: "", year: "2024", format: "", category: "" });
    expect(hrefOf("2019")).toBe("/replays?year=2019");
  });

  it("should keep the watch link pointing at the recording", () => {
    renderCard();
    expect(hrefOf(/Revoir/)).toBe("https://www.youtube.com/watch?v=abc");
  });

  it("should link a speaker to their year-scoped page", () => {
    renderCard();
    expect(hrefOf("Ada Lovelace")).toBe("/editions/2019/speakers/ada");
  });
});
