import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

import ScheduleGrid from "./ScheduleGrid";
import type { ScheduleRow } from "@/lib/schedule";
import type { ScheduleRoom } from "@/lib/types";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Eight rooms need 1616 px and a 1440 px screen offers 1377 (#455). The two
// rooms past the edge were unreachable in the sense that matters: nothing said
// they were there. jsdom has no layout, so the widths are declared here and the
// assertion is that the grid draws its edge cue from them.

const rooms: ScheduleRoom[] = [
  { id: 1, name: "Amphithéâtre" },
  { id: 2, name: "Salle Communautés" },
] as ScheduleRoom[];

const rows: ScheduleRow[] = [
  {
    type: "slot",
    key: "slot:1",
    startsAt: "2026-11-19T08:50:00.000Z",
    cells: [[], []],
  },
];

const props = {
  rows,
  rooms,
  locale: "fr",
  formatLabels: { CONFERENCE: "Conférence" },
  labels: { timeColumn: "Horaire", roomTba: "À venir" },
  favourites: new Set<string>(),
  onToggleFavourite: () => {},
  favouriteLabels: { add: "Ajouter", remove: "Retirer" },
};

/** Declare the scroll geometry jsdom will not compute, then let the grid read it. */
function setScrollGeometry(scrollWidth: number, clientWidth: number, scrollLeft = 0) {
  const scroller = document.querySelector(".overflow-auto") as HTMLElement;
  Object.defineProperty(scroller, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(scroller, "clientWidth", { value: clientWidth, configurable: true });
  scroller.scrollLeft = scrollLeft;
  act(() => {
    scroller.dispatchEvent(new Event("scroll"));
  });
  return scroller;
}

describe("ScheduleGrid overflow cue", () => {
  it("shows an edge cue when rooms continue past the right of the box", () => {
    const { container } = render(<ScheduleGrid {...props} />);
    setScrollGeometry(1616, 1377);

    expect(container.querySelector('[aria-hidden][class*="right-0"]')).toBeInTheDocument();
  });

  it("shows none when the whole grid fits — a permanent fade would lie", () => {
    const { container } = render(<ScheduleGrid {...props} />);
    setScrollGeometry(1200, 1377);

    expect(container.querySelector('[aria-hidden][class*="right-0"]')).not.toBeInTheDocument();
  });

  it("drops the cue once the reader has reached the far right", () => {
    const { container } = render(<ScheduleGrid {...props} />);
    setScrollGeometry(1616, 1377, 239);

    expect(container.querySelector('[aria-hidden][class*="right-0"]')).not.toBeInTheDocument();
  });

  it("keeps every room in the accessibility tree, scrolled or not", () => {
    render(<ScheduleGrid {...props} />);
    setScrollGeometry(1616, 1377);

    // The cue is decorative: the table is complete either way, so a screen
    // reader never depends on scrolling to hear the last room.
    expect(screen.getByRole("columnheader", { name: "Salle Communautés" })).toBeInTheDocument();
  });
});
