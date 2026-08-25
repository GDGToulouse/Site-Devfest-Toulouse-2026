import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import SessionCard from "./SessionCard";
import type { ScheduleTalk } from "@/lib/schedule";

// next-intl's localized Link pulls in next/navigation, which does not resolve
// under vitest's ESM loader. The card only ever renders plain anchors, and the
// attributes have to survive the passthrough — the stretched link and the
// bubbles' accessible names are asserted on them.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// What a card carries depends on where it is drawn (#457). In a 180 px grid
// column it used to repeat the start time the row header already announced,
// stack two pastel badges above the title, and spend a line on the speakers —
// so the title, the only thing a visitor scans for, came fourth.

const talk = {
  slug: "observabilite-opentelemetry",
  title: "Observabilité : OpenTelemetry en pratique",
  format: "CONFERENCE",
  startsAt: "2026-11-19T08:50:00.000Z",
  endsAt: "2026-11-19T09:30:00.000Z",
  speakers: [{ slug: "marie-dupont", name: "Marie Dupont", photoUrl: null }],
  category: { nameFr: "Cloud & DevOps", nameEn: "Cloud & DevOps", color: "#3B6BB0" },
} as unknown as ScheduleTalk;

const formatLabels = { CONFERENCE: "Conférence", QUICKIE: "Quickie" };

function withSpeakers(names: string[]): ScheduleTalk {
  return {
    ...talk,
    speakers: names.map((name) => ({
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      photoUrl: null,
    })),
  } as ScheduleTalk;
}

describe("SessionCard in the grid", () => {
  it("does not repeat the start time the row header already gives", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    // 09:50 is the row it sits in; printing it in all seven cells of that row
    // was the redundancy that pushed the title down the card.
    expect(screen.queryByText(/09:50/)).not.toBeInTheDocument();
  });

  it("names the format in words and gives the duration instead", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    expect(screen.getByText("Conférence · 40 min")).toBeInTheDocument();
  });

  it("keeps the category badge — the only one carrying meaning", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    // One badge, not two: the format is no longer a pill.
    expect(screen.getByText("Cloud & DevOps")).toBeInTheDocument();
    expect(screen.queryByText("Conférence")).not.toBeInTheDocument();
  });

  it("lets a long category name wrap rather than widen its column (#460)", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    // jsdom has no layout, so the class is all there is to assert on — but the
    // decision is worth pinning: kept on one line, the badge's intrinsic width
    // becomes the column's floor, and "Craft & Architecture" pushed two columns
    // from 180 px to 192, widening the whole grid by 24 px at 1650.
    expect(screen.getByText("Cloud & DevOps").className).not.toMatch(/whitespace-nowrap/);
  });

  it("still spells out no name — that is what #457 bought the title", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    // The face came back (#463), the line of text did not: nothing in the card
    // is the string "Marie Dupont".
    expect(screen.queryByText("Marie Dupont")).not.toBeInTheDocument();
    expect(screen.getByText(talk.title)).toBeInTheDocument();
  });
});

// #463 — a face is recognised without being read, and it rides on the line the
// format and duration already occupy, so it costs the card no height.

describe("the speaker bubble on a grid card", () => {
  it("shows the speaker and leads to their page", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    const bubble = screen.getByRole("link", { name: "Marie Dupont" });
    expect(bubble).toHaveAttribute("href", "/speakers/marie-dupont");
  });

  it("names the link after the speaker, not after their initial", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    // With no photo the bubble is a lone "M", and the image's alt text is what
    // normally names the link — so the link announced itself as "M". Bearable
    // beside a visible name, useless when the bubble stands alone.
    expect(screen.queryByRole("link", { name: "M" })).not.toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("folds a crowded talk into three faces and a +N", () => {
    render(
      <SessionCard
        talk={withSpeakers(["Ada Lovelace", "Alan Turing", "Grace Hopper", "Edsger Dijkstra"])}
        locale="fr"
        formatLabels={formatLabels}
        variant="grid"
      />,
    );

    // A fourth bubble does not fit in 180 px, and widening the column would
    // widen the whole grid — the table is auto-laid-out (#460).
    expect(screen.getAllByRole("link", { name: /Lovelace|Turing|Hopper|Dijkstra/ })).toHaveLength(3);
    expect(screen.getByText("+1")).toBeInTheDocument();
    // The folded name is not simply lost: no names line here to carry it.
    expect(screen.getByTitle("Edsger Dijkstra")).toBeInTheDocument();
  });

  it("draws the bubble at grid size, initial included", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    // 24 px, not the 32 of the conference list: the size drives the box, the
    // `sizes` hint of next/image and the initial's scale together, so checking
    // the initial checks all three came from the same value.
    expect(screen.getByText("M")).toHaveStyle({ fontSize: "9px" });
  });

  it("carries the same faces on a relayed card — it is the same session", () => {
    render(
      <SessionCard
        talk={talk}
        locale="fr"
        formatLabels={formatLabels}
        variant="grid"
        isSimulcast
        simulcastLabel="Retransmission"
      />,
    );

    expect(screen.getByRole("link", { name: "Marie Dupont" })).toBeInTheDocument();
  });

  it("leaves the agenda alone, where the names are written out", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="agenda" />);

    // The discriminant: this is the assertion that falls if `grid` ever stops
    // being the condition for the bubbles.
    expect(screen.queryByRole("link", { name: "Marie Dupont" })).not.toBeInTheDocument();
    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
  });
});

describe("the card as a link", () => {
  it("stretches the title's link over the whole card", () => {
    const { container } = render(
      <SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />,
    );

    const title = screen.getByRole("link", { name: talk.title });
    expect(title.className).toContain("after:absolute");
    expect(title.className).toContain("after:inset-0");
    // The pseudo-element resolves against the card, so the card has to be the
    // containing block — otherwise it would cover the viewport instead.
    expect(container.firstElementChild!.className).toContain("relative");
  });

  it("keeps every link a sibling, never nested", () => {
    const { container } = render(
      <SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />,
    );

    // Wrapping the card in a link is exactly what a bubble inside it forbids:
    // browsers "repair" <a> in <a> by breaking the structure apart, stranding
    // the inner link — keyboard included.
    expect(container.querySelector("a a")).toBeNull();
  });

  it("leaves the site-wide focus outline alone", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    // globals.css draws `:focus-visible` for the whole site. The card used to
    // opt out and ring itself; with the link now wrapping only the title, that
    // ring would have outlined the words rather than the card (#350).
    const title = screen.getByRole("link", { name: talk.title });
    expect(title.className).not.toMatch(/outline-none|\[outline:none\]/);
  });
});

describe("SessionCard in the mobile agenda", () => {
  it("keeps what the grid drops — the width is not the constraint there", () => {
    render(
      <SessionCard
        talk={talk}
        locale="fr"
        formatLabels={formatLabels}
        roomName="Amphithéâtre"
        variant="agenda"
      />,
    );

    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("Conférence")).toBeInTheDocument();
    // The room has no column to name it in a linear list, so the card must.
    expect(screen.getByText(/09:50 – 09:30|09:50/)).toBeInTheDocument();
    expect(screen.getByText(/Amphithéâtre/)).toBeInTheDocument();
  });

  it("is the default, so no caller loses information by omission", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} />);

    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
  });
});
