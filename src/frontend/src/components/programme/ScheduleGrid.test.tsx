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
    covered: [false, false],
  },
];

const talk = {
  slug: "terraform-sans-douleur",
  title: "Terraform sans douleur",
  format: "CONFERENCE",
  startsAt: "2026-11-19T08:50:00.000Z",
  endsAt: "2026-11-19T09:30:00.000Z",
  speakers: [],
  category: null,
} as unknown as ScheduleRow extends { cells: (infer C)[][] } ? C : never;

const props = {
  rows,
  rooms,
  locale: "fr",
  formatLabels: { CONFERENCE: "Conférence" },
  labels: { timeColumn: "Horaire", roomTba: "À venir", simulcast: "Retransmission" },
  favourites: new Set<string>(),
  onToggleFavourite: () => {},
  favouriteLabels: { add: "Ajouter", remove: "Retirer" },
};

/** Declare the scroll geometry jsdom will not compute, then let the grid read it. */
function setScrollGeometry(scrollWidth: number, clientWidth: number, scrollLeft = 0) {
  // The table's parent, not a utility class: the class changed with #460 and
  // took four tests down with it, for a rename that changed no behaviour.
  const scroller = document.querySelector("table")!.parentElement as HTMLElement;
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

describe("a room with nothing on at that hour", () => {
  it("marks the gap instead of leaving a blank", () => {
    // In a grid that is otherwise full — which is what the real programme looks
    // like — a white hole reads as "not loaded yet" as readily as "nothing
    // scheduled". Only the grid has the problem: the agenda and the by-hour
    // print are lists, where an absent room leaves no gap at all.
    const { container } = render(<ScheduleGrid {...props} />);

    const marks = container.querySelectorAll("td > [aria-hidden]");
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent("—");
  });

  it("leaves an occupied cell alone", () => {
    const filled: ScheduleRow[] = [
      {
        type: "slot",
        key: "slot:1",
        startsAt: "2026-11-19T08:50:00.000Z",
        cells: [[{ talk, isSimulcast: false, rowSpan: 1 }], []],
        covered: [false, false],
      },
    ];
    const { container } = render(<ScheduleGrid {...props} rows={filled} />);

    // One gap left, not two: the marker must not sit under a session.
    expect(container.querySelectorAll("td > [aria-hidden]")).toHaveLength(1);
    expect(screen.getByText("Terraform sans douleur")).toBeInTheDocument();
  });
});

describe("a session reaching across two rows", () => {
  const spanning: ScheduleRow[] = [
    {
      type: "slot",
      key: "slot:1",
      startsAt: "2026-11-19T08:50:00.000Z",
      cells: [[{ talk, isSimulcast: false, rowSpan: 2 }], []],
      covered: [false, false],
    },
    {
      type: "slot",
      key: "slot:2",
      startsAt: "2026-11-19T09:10:00.000Z",
      cells: [[], []],
      covered: [true, false],
    },
  ];

  it("draws one cell, told how far it reaches", () => {
    const { container } = render(<ScheduleGrid {...props} rows={spanning} />);

    const cell = container.querySelector("tbody td");
    expect(cell).toHaveAttribute("rowspan", "2");
    expect(screen.getAllByText("Terraform sans douleur")).toHaveLength(1);
  });

  it("draws no cell at all where it still runs", () => {
    const { container } = render(<ScheduleGrid {...props} rows={spanning} />);
    const rows = container.querySelectorAll("tbody tr");

    // A second `<td>` under a spanning one pushes the whole row sideways —
    // every room after it would be drawn under the wrong column (#462).
    expect(rows[0].querySelectorAll("td")).toHaveLength(2);
    expect(rows[1].querySelectorAll("td")).toHaveLength(1);
    // And the one cell it does draw is the free room, with its marker.
    expect(rows[1].querySelectorAll("td > [aria-hidden]")).toHaveLength(1);
  });
});

describe("the room row pinned to the viewport", () => {
  it("copies the rooms without duplicating them for a screen reader", () => {
    const { container } = render(<ScheduleGrid {...props} />);

    // A copy is the only way to pin this row (#460): the real one lives inside
    // a horizontal scroll container, and a sticky child of one resolves against
    // that box rather than the page — so it followed the box out of view.
    const pinned = container.querySelector("[aria-hidden].sticky");
    expect(pinned).toHaveTextContent("Amphithéâtre");
    expect(pinned).toHaveTextContent("Salle Communautés");

    // Exactly one of the two is announced, and it is the real `<th>`: a copy in
    // the accessibility tree would read every room name twice.
    expect(screen.getAllByRole("columnheader", { name: "Amphithéâtre" })).toHaveLength(1);
  });

  it("shifts with the horizontal scroll, or it would name the wrong columns", () => {
    render(<ScheduleGrid {...props} />);
    const scroller = document.querySelector("table")!.parentElement as HTMLElement;
    const row = document.querySelector("[aria-hidden].sticky > div > div") as HTMLElement;

    expect(row.style.transform).toBe("translateX(0px)");

    scroller.scrollLeft = 240;
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(row.style.transform).toBe("translateX(-240px)");
  });
});
