import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import SpeakerAvatars from "./SpeakerAvatars";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const speakers = [
  { slug: "ada", name: "Ada Lovelace", photoUrl: null },
  { slug: "alan", name: "Alan Turing", photoUrl: null },
  { slug: "grace", name: "Grace Hopper", photoUrl: null },
  { slug: "edsger", name: "Edsger Dijkstra", photoUrl: null },
  { slug: "barbara", name: "Barbara Liskov", photoUrl: null },
];

// The defaults are what the conference list (#207) and the Hall of replays
// (#344) already render; the schedule grid (#463) is the caller that needed
// them to move, and it must move them without disturbing those two.

describe("by default", () => {
  it("shows four faces, a +N, and the full names beside them", () => {
    render(<SpeakerAvatars speakers={speakers} />);

    expect(screen.getAllByTitle(/Lovelace|Turing|Hopper|Dijkstra|Liskov/)).toHaveLength(4);
    expect(screen.getByText("+1")).toBeInTheDocument();
    // Every name is written out, folded ones included — that is what the names
    // line is for.
    expect(screen.getByRole("link", { name: "Barbara Liskov" })).toBeInTheDocument();
  });

  it("leaves the bubble unnamed where a named link already sits beside it", () => {
    render(<SpeakerAvatars speakers={[speakers[0]]} />);

    // Naming the bubble too would put two links of the same name and the same
    // target side by side — the fix of #463 belongs to bubbles-only mode.
    expect(screen.getAllByRole("link", { name: "Ada Lovelace" })).toHaveLength(1);
  });

  it("draws the bubble at 32 px", () => {
    render(<SpeakerAvatars speakers={[speakers[0]]} />);

    expect(screen.getByTitle("Ada Lovelace")).toHaveStyle({ width: "32px", height: "32px" });
  });
});

describe("in bubbles-only mode (#463)", () => {
  it("writes no name at all", () => {
    render(<SpeakerAvatars speakers={speakers} withNames={false} />);

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    // One link per face, not two: the names line is what used to double them.
    expect(screen.getAllByRole("link", { name: "Ada Lovelace" })).toHaveLength(1);
  });

  it("still names each link after its speaker", () => {
    render(<SpeakerAvatars speakers={[speakers[0]]} withNames={false} size={24} />);

    // Without a photo the bubble holds one initial, and the alt text of the
    // image is what would otherwise name the link — here, "A".
    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "A" })).not.toBeInTheDocument();
  });

  it("hangs the folded names off the +N, the only trace they leave", () => {
    render(<SpeakerAvatars speakers={speakers} max={3} withNames={false} />);

    expect(screen.getByText("+2")).toHaveAttribute("title", "Edsger Dijkstra, Barbara Liskov");
  });

  it("scales the box and the initial from one value", () => {
    render(<SpeakerAvatars speakers={[speakers[0]]} withNames={false} size={24} />);

    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toHaveStyle({
      width: "24px",
      height: "24px",
    });
    // 24 / 2.6 rounded — the same ratio SpeakerPhoto uses at every other size.
    expect(screen.getByText("A")).toHaveStyle({ fontSize: "9px" });
  });
});

describe("when the caller already wraps the card in a link", () => {
  it("renders no link of its own, whatever the size", () => {
    const { container } = render(<SpeakerAvatars speakers={speakers} asPlainText size={24} />);

    // <a> inside <a> is invalid markup; the conference list still wraps its
    // cards, so its avatars stay inert spans.
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByTitle("Ada Lovelace")).toHaveStyle({ width: "24px" });
  });
});
