import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import SpeakerPicker from "./SpeakerPicker";

// #508 — a talk's speakers were a checkbox per speaker of the year, 50 to 64 of
// them: unreadable. They are now chips picked from a searchable list.

const SPEAKERS = [
  { id: 1, name: "Zoé Martin", company: "Acme" },
  { id: 2, name: "Éric Durand", company: "Garonne Digital" },
  { id: 3, name: "Ada Lovelace", company: null },
];

function Harness({ initial = [] as number[] }) {
  const [ids, setIds] = useState<number[]>(initial);
  return <SpeakerPicker speakers={SPEAKERS} selectedIds={ids} onChange={setIds} />;
}

const combobox = () => screen.getByRole("combobox", { name: "Speakers" });

describe("SpeakerPicker (#508)", () => {
  it("should show the chosen speakers as chips sorted by name, as the site lists them", () => {
    render(<Harness initial={[1, 3]} />);

    const chips = screen.getAllByRole("button", { name: /^Retirer / }).map((b) => b.getAttribute("aria-label"));
    expect(chips).toEqual(["Retirer Ada Lovelace", "Retirer Zoé Martin"]);
  });

  it("should find a speaker ignoring accents and case, by name or company, and add it", async () => {
    render(<Harness />);

    await userEvent.type(combobox(), "eric");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Éric Durand — Garonne Digital"]);

    await userEvent.click(screen.getByRole("option", { name: /Éric Durand/ }));
    expect(screen.getByRole("button", { name: "Retirer Éric Durand" })).toBeInTheDocument();

    await userEvent.clear(combobox());
    await userEvent.type(combobox(), "acme");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Zoé Martin — Acme"]);
  });

  it("should pick with the arrow keys and Enter, and remove the last chip with Backspace", async () => {
    render(<Harness />);

    await userEvent.click(combobox());
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByRole("button", { name: "Retirer Éric Durand" })).toBeInTheDocument();

    await userEvent.keyboard("{Backspace}");
    expect(screen.queryByRole("button", { name: /^Retirer / })).not.toBeInTheDocument();
  });

  it("should never offer to create a speaker, and say where to attach one", async () => {
    render(<Harness />);

    await userEvent.type(combobox(), "Inconnu");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText(/Aucun speaker trouvé/)).toBeInTheDocument();
  });

  it("should leave out the speakers already chosen", async () => {
    render(<Harness initial={[3]} />);

    await userEvent.click(combobox());

    expect(screen.getAllByRole("option").map((o) => o.textContent)).not.toContain("Ada Lovelace");
  });
});
