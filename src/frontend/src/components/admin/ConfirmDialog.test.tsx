import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ConfirmDialog from "./ConfirmDialog";

// ConfirmDialog gates every destructive admin action (delete, purge, restore).
// Its behaviour — right callback on the right control, closed = nothing rendered,
// danger styling, Escape/backdrop to cancel — is what these lock.

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      isOpen
      title="Supprimer l'article"
      message="Cette action est irréversible."
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="x"
        message="y"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title and message when open", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Supprimer l'article")).toBeInTheDocument();
    expect(screen.getByText("Cette action est irréversible.")).toBeInTheDocument();
  });

  it("calls onConfirm — and only onConfirm — when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup({ confirmLabel: "Supprimer" });
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels on Escape (a mis-fired confirm must not delete)", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("uses the danger styling for a destructive confirm", () => {
    setup({ variant: "danger", confirmLabel: "Supprimer définitivement" });
    const confirm = screen.getByRole("button", { name: "Supprimer définitivement" });
    // The danger variant swaps the confirm button to terre-cuite (#terracotta).
    expect(confirm.className).toContain("terre-cuite");
  });

  it("defaults the confirm button to malachite otherwise", () => {
    setup({ confirmLabel: "Confirmer" });
    const confirm = screen.getByRole("button", { name: "Confirmer" });
    expect(confirm.className).toContain("malachite");
    expect(confirm.className).not.toContain("terre-cuite");
  });

  it("is an accessible modal dialog", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Title and message are wired via aria-labelledby / aria-describedby.
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");
  });
});
