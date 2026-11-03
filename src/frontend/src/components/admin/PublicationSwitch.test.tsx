import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PublicationSwitch, { type ClosedOption, type PublicationStatus, type TalkStatus } from "./PublicationSwitch";

// #632 — a checkbox or a badge did not say that clicking changes what the site
// shows. Both choices are now visible, the consequence is written, and taking a
// live record off the site asks first.

function Harness({ initial, saved, onChange = () => {} }: { initial: PublicationStatus; saved?: PublicationStatus; onChange?: (s: PublicationStatus) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PublicationSwitch
      label="Statut de la conférence"
      value={value}
      savedValue={saved}
      unpublishMessage="Retirer « IA » du site ?"
      previewHref="/api/preview?type=talk&year=2026&slug=ia"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("PublicationSwitch (#632)", () => {
  it("should show both choices and say what the current one does", async () => {
    render(<Harness initial="DRAFT" />);

    expect(screen.getByRole("radiogroup", { name: "Statut de la conférence" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Brouillon" })).toBeChecked();
    expect(screen.getByText(/Invisible sur le site/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prévisualiser" })).toHaveAttribute("href", "/api/preview?type=talk&year=2026&slug=ia");

    await userEvent.click(screen.getByRole("radio", { name: "Publié" }));

    expect(screen.getByRole("radio", { name: "Publié" })).toBeChecked();
    expect(screen.getByText("Visible sur le site.")).toBeInTheDocument();
  });

  it("should ask before taking a live record off the site, and keep it on cancel", async () => {
    const onChange = vi.fn();
    render(<Harness initial="PUBLISHED" saved="PUBLISHED" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Brouillon" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Retirer « IA » du site ?");
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Publié" })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "Brouillon" }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer du site" }));

    expect(onChange).toHaveBeenCalledWith("DRAFT");
  });

  it("should not ask when the record was never saved as published", async () => {
    const onChange = vi.fn();
    render(<Harness initial="PUBLISHED" saved="DRAFT" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Brouillon" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("DRAFT");
  });

  it("should move the choice with the arrow keys from a single tab stop", async () => {
    render(<Harness initial="DRAFT" />);

    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Brouillon" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Publié" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Publié" })).toHaveFocus();
  });
});

// #726 — a cancelled talk is not a draft: the third choice says so, asks before
// it is taken, and its consequence replaces the draft's.
const CANCELLED: ClosedOption = {
  status: "CANCELLED",
  label: "Annulé",
  hint: "Annulé : invisible sur le site, son créneau et sa salle sont conservés.",
  confirmTitle: "Annuler la conférence ?",
  confirmMessage: "« IA » n'aura pas lieu.",
  confirmLabel: "Marquer annulée",
};

function TalkHarness({ initial, saved, onChange = () => {} }: { initial: TalkStatus; saved?: TalkStatus; onChange?: (s: TalkStatus) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PublicationSwitch<TalkStatus>
      label="Statut de la conférence"
      value={value}
      savedValue={saved}
      closed={CANCELLED}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("PublicationSwitch with a cancelled state (#726)", () => {
  it("should show three choices and the cancelled consequence", () => {
    render(<TalkHarness initial="CANCELLED" saved="CANCELLED" />);

    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Brouillon", "Publié", "Annulé"]);
    expect(screen.getByRole("radio", { name: "Annulé" })).toBeChecked();
    expect(screen.getByText(CANCELLED.hint)).toBeInTheDocument();
  });

  it("should ask before cancelling, and keep the status on cancel", async () => {
    const onChange = vi.fn();
    render(<TalkHarness initial="DRAFT" saved="DRAFT" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Annulé" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("« IA » n'aura pas lieu.");
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Brouillon" })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "Annulé" }));
    await userEvent.click(screen.getByRole("button", { name: "Marquer annulée" }));

    expect(onChange).toHaveBeenCalledWith("CANCELLED");
    expect(screen.getByRole("radio", { name: "Annulé" })).toBeChecked();
  });

  it("should restore a cancelled talk without asking", async () => {
    const onChange = vi.fn();
    render(<TalkHarness initial="CANCELLED" saved="CANCELLED" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Publié" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("PUBLISHED");
  });

  it("should walk the three choices with the arrow keys", async () => {
    render(<TalkHarness initial="DRAFT" saved="CANCELLED" />);

    await userEvent.tab();
    await userEvent.keyboard("{ArrowLeft}");

    expect(screen.getByRole("radio", { name: "Annulé" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Annulé" })).toHaveFocus();
  });
});
