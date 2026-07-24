import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataTable from "./DataTable";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

const columns = [{ key: "name", label: "Nom" }];

describe("DataTable", () => {
  it("shows the empty message when there is no data", () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Rien ici" />);
    expect(screen.getByText("Rien ici")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a row per item, using a custom render when given", () => {
    render(
      <DataTable
        columns={[{ key: "name", label: "Nom", render: (r) => <strong>{r.name.toUpperCase()}</strong> }]}
        data={rows}
      />,
    );
    expect(screen.getByText("ALICE")).toBeInTheDocument();
    expect(screen.getByText("BOB")).toBeInTheDocument();
  });

  it("shows no Actions column when neither onEdit nor onDelete is passed", () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("calls onEdit / onDelete with the right row", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<DataTable columns={columns} data={rows} onEdit={onEdit} onDelete={onDelete} />);

    // Two rows → two Modifier buttons; the first belongs to Alice.
    await user.click(screen.getAllByRole("button", { name: "Modifier" })[0]);
    expect(onEdit).toHaveBeenCalledWith(rows[0]);

    await user.click(screen.getAllByRole("button", { name: "Supprimer" })[1]);
    expect(onDelete).toHaveBeenCalledWith(rows[1]);
  });

  it("stays non-selectable without selectedIds/onSelectionChange", () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("toggles a single row's selection", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );
    await user.click(screen.getByLabelText("Sélectionner la ligne 2"));
    // Handler gets the next selection, computed from the current one.
    expect(onSelectionChange).toHaveBeenCalledWith(new Set([2]));
  });

  it("unchecks a row that was already selected", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        selectedIds={new Set([1, 2])}
        onSelectionChange={onSelectionChange}
      />,
    );
    // Clicking a selected row removes just it — the other stays. A toggle that
    // only ever adds (the bug this guards) would send Set([1,2]) unchanged.
    await user.click(screen.getByLabelText("Sélectionner la ligne 1"));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set([2]));
  });

  it("select-all sends every id; unselect-all sends an empty set", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={rows}
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(screen.getByLabelText("Tout sélectionner"));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set([1, 2]));

    // With everything already selected, the header checkbox is checked and
    // clicking it clears the selection.
    rerender(
      <DataTable
        columns={columns}
        data={rows}
        selectedIds={new Set([1, 2])}
        onSelectionChange={onSelectionChange}
      />,
    );
    const selectAll = screen.getByLabelText("Tout sélectionner") as HTMLInputElement;
    expect(selectAll.checked).toBe(true);
    await user.click(selectAll);
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set());
  });
});
