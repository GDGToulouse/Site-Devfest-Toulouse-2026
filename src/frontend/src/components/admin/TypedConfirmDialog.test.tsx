import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TypedConfirmDialog from "./TypedConfirmDialog";

function setup() {
  const onConfirm = vi.fn();
  render(
    <TypedConfirmDialog
      isOpen
      title="Annuler le gel ?"
      message="Les numéros sont effacés."
      word="ANNULER"
      confirmLabel="Annuler le gel"
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return { onConfirm };
}

describe("TypedConfirmDialog (#774)", () => {
  it("should keep the confirm button disabled until the word is typed exactly", async () => {
    const { onConfirm } = setup();
    const button = screen.getByRole("button", { name: "Annuler le gel" });

    await userEvent.type(screen.getByRole("textbox"), "annuler");
    expect(button).toBeDisabled();

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "ANNULER");
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
