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

    // Icon buttons named after their row (#499): a screen reader hears which
    // one it is about to act on, not ten identical "Modifier".
    await user.click(screen.getByRole("button", { name: "Modifier Alice" }));
    expect(onEdit).toHaveBeenCalledWith(rows[0]);

    await user.click(screen.getByRole("button", { name: "Supprimer Bob" }));
    expect(onDelete).toHaveBeenCalledWith(rows[1]);
  });

  it("should show icons rather than text labels, and name rows with rowLabel when given (#499)", () => {
    render(
      <DataTable columns={columns} data={rows} onEdit={vi.fn()} rowLabel={(r) => `la ligne de ${r.name}`} />,
    );

    expect(screen.getByRole("button", { name: "Modifier la ligne de Alice" })).toBeInTheDocument();
    expect(screen.queryByText("Modifier")).not.toBeInTheDocument();
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

// #498 — sorting is opt-in per column: a column that declares `sortValue`
// gets a header button cycling ascending then descending; the others, and the
// lists that declare none, render exactly as before.
describe("DataTable sorting (#498)", () => {
  const people = [
    { id: 1, name: "Bob", rank: 2 },
    { id: 2, name: "alice", rank: 3 },
    { id: 3, name: "Chloé", rank: 1 },
  ];
  const sortable = [
    { key: "name", label: "Nom", sortValue: (p: (typeof people)[number]) => p.name },
    { key: "rank", label: "Rang", sortValue: (p: (typeof people)[number]) => p.rank },
    { key: "id", label: "Id" },
  ];
  const firstColumn = () => screen.getAllByRole("row").slice(1).map((r) => r.querySelector("td")!.textContent);

  it("should sort a column ascending, then descending, on its header", async () => {
    render(<DataTable columns={sortable} data={people} />);

    await userEvent.click(screen.getByRole("button", { name: "Nom" }));
    expect(firstColumn()).toEqual(["alice", "Bob", "Chloé"]);
    expect(screen.getByRole("columnheader", { name: "Nom" })).toHaveAttribute("aria-sort", "ascending");

    await userEvent.click(screen.getByRole("button", { name: "Nom" }));
    expect(firstColumn()).toEqual(["Chloé", "Bob", "alice"]);
    expect(screen.getByRole("columnheader", { name: "Nom" })).toHaveAttribute("aria-sort", "descending");
  });

  it("should sort numbers as numbers", async () => {
    render(<DataTable columns={sortable} data={people} />);

    await userEvent.click(screen.getByRole("button", { name: "Rang" }));

    expect(firstColumn()).toEqual(["Chloé", "Bob", "alice"]);
  });

  it("should leave a column without sortValue as a plain header, and keep the given order until asked", () => {
    render(<DataTable columns={sortable} data={people} />);

    expect(screen.queryByRole("button", { name: "Id" })).not.toBeInTheDocument();
    expect(firstColumn()).toEqual(["Bob", "alice", "Chloé"]);
  });
});
