import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import SessionCard from "./SessionCard";
import type { ScheduleTalk } from "@/lib/schedule";

// next-intl's localized Link pulls in next/navigation, which does not resolve
// under vitest's ESM loader. The card only needs an anchor around its content.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
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
  speakers: [{ name: "Marie Dupont" }],
  category: { nameFr: "Cloud & DevOps", nameEn: "Cloud & DevOps", color: "#3B6BB0" },
} as unknown as ScheduleTalk;

const formatLabels = { CONFERENCE: "Conférence", QUICKIE: "Quickie" };

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

  it("drops the speakers, which cost the title a line at 180 px", () => {
    render(<SessionCard talk={talk} locale="fr" formatLabels={formatLabels} variant="grid" />);

    expect(screen.queryByText("Marie Dupont")).not.toBeInTheDocument();
    expect(screen.getByText(talk.title)).toBeInTheDocument();
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
