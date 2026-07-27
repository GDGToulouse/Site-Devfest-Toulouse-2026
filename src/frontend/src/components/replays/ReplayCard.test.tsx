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

// #350 — the card looked clickable (shadow lifting on hover) but only the title
// was. It is now covered by the title's stretched pseudo-element, which must not
// come at the cost of the five links the card already carries.
describe("ReplayCard — the whole card opens the talk", () => {
  it("should stretch the title link over the card", () => {
    const { container } = render(
      <ReplayCard replay={replay} locale="fr" current={noFilter} labels={labels} />,
    );

    const title = screen.getByRole("link", { name: "Un talk mémorable" });
    expect(title.className).toContain("after:absolute");
    expect(title.className).toContain("after:inset-0");
    // The pseudo-element is positioned against the card, so the card is the
    // containing block — without this it would cover the viewport instead.
    expect(container.querySelector("article")!.className).toContain("relative");
  });

  // Nesting <a> inside <a> is invalid HTML: browsers "repair" it by breaking the
  // structure apart, which would strand the inner links — keyboard included.
  it("should keep every link a sibling, never nested", () => {
    const { container } = render(
      <ReplayCard replay={replay} locale="fr" current={noFilter} labels={labels} />,
    );

    expect(container.querySelector("a a")).toBeNull();
  });

  // The stretched pseudo-element paints over the card, so anything meant to stay
  // clickable has to be lifted back above it.
  it("should keep the inner links reachable above the stretched area", () => {
    renderCard();

    for (const name of ["Ada Lovelace", "2019", "Conférence", "Langages de programmation"]) {
      expect(screen.getByRole("link", { name }).className).toContain("relative");
    }
  });

  // The watch button leaves for YouTube; swallowed by the stretched area it
  // would quietly open the talk page instead.
  it("should keep the watch button above the stretched area too", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /Revoir/ }).className).toContain("relative");
  });

  it("should still send each inner link to its own destination", () => {
    renderCard();

    expect(hrefOf("Ada Lovelace")).toBe("/editions/2019/speakers/ada");
    expect(hrefOf("2019")).toBe("/replays?year=2019");
    expect(hrefOf(/Revoir/)).toBe("https://www.youtube.com/watch?v=abc");
    expect(hrefOf("Un talk mémorable")).toBe("/editions/2019/conferences/un-talk");
  });
});
