"use client";

import { useMemo, useState } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  // Sorting is opt-in per column (#498): give the value to sort on, and the
  // header becomes a button cycling ascending then descending.
  sortValue?: (item: T) => string | number;
}

type SortDirection = "ascending" | "descending";

// French collation, so accents and case do not scatter the alphabet ("alice"
// next to "Alice", "Élise" among the E).
const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  emptyMessage?: string;
  // Row selection is opt-in: pass the current selection and a setter to turn
  // the checkbox column on. Left undefined, the table renders exactly as before.
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
  // Names the row in its action buttons ("Modifier Acme", #499). Defaults to
  // the row's name or title, which covers the lists that use the table.
  rowLabel?: (item: T) => string;
}

function defaultRowLabel(item: { id: number }): string {
  const row = item as { name?: unknown; title?: unknown; nameFr?: unknown };
  const label = row.name ?? row.title ?? row.nameFr;
  return typeof label === "string" && label.trim() ? label : `ligne ${item.id}`;
}

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  onEdit,
  onDelete,
  emptyMessage = "Aucun element",
  selectedIds,
  onSelectionChange,
  rowLabel = defaultRowLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return data;
    const value = column.sortValue;
    const sign = sort.direction === "ascending" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const order = typeof va === "number" && typeof vb === "number" ? va - vb : collator.compare(String(va), String(vb));
      return order * sign;
    });
  }, [data, columns, sort]);

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key && current.direction === "ascending"
        ? { key, direction: "descending" }
        : { key, direction: "ascending" },
    );

  if (data.length === 0) {
    return <p className="text-gris py-8 text-center">{emptyMessage}</p>;
  }

  const isSelectable = selectedIds !== undefined && onSelectionChange !== undefined;
  const allSelected = isSelectable && data.length > 0 && data.every((item) => selectedIds!.has(item.id));

  const toggleAll = () => {
    if (!isSelectable) return;
    onSelectionChange!(allSelected ? new Set() : new Set(data.map((item) => item.id)));
  };

  const toggleOne = (id: number) => {
    if (!isSelectable) return;
    const next = new Set(selectedIds!);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange!(next);
  };

  return (
    // overflow-y-hidden is deliberate: with only `overflow-x-auto`, CSS computes
    // overflow-y as `auto` too (a visible/auto pair resolves to auto), so on
    // mobile this wrapper captured the vertical touch-scroll and the list could
    // not be scrolled past the first screenful (#244). Pinning overflow-y to
    // hidden keeps horizontal column scrolling while letting the vertical
    // gesture bubble up to the admin shell's scrollable <main>.
    <div className="overflow-x-auto overflow-y-hidden rounded-xl shadow-card bg-blanc">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-blanc-casse/60 border-b border-gris/20">
            {isSelectable && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                  className="h-4 w-4 accent-malachite cursor-pointer"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-3 font-medium text-gris"
                aria-sort={sort?.key === col.key ? sort.direction : col.sortValue ? "none" : undefined}
              >
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-noir"
                  >
                    {col.label}
                    <span aria-hidden="true" className="text-xs">
                      {sort?.key === col.key ? (sort.direction === "ascending" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
              {isSelectable && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds!.has(item.id)}
                    onChange={() => toggleOne(item.id)}
                    aria-label={`Sélectionner la ligne ${item.id}`}
                    className="h-4 w-4 accent-malachite cursor-pointer"
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-noir">
                  {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-4 py-3 text-right">
                  {/* Icon buttons, like the users list (#499). The aria-label
                      names the row: a `title` alone is not read reliably, and
                      ten identical "Modifier" tell a screen reader nothing.
                      p-2 around a 16 px icon keeps the target above 24 px. */}
                  <div className="flex justify-end gap-1">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        aria-label={`Modifier ${rowLabel(item)}`}
                        title="Modifier"
                        className="p-2 rounded-lg text-bleu hover:bg-bleu/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bleu transition-colors"
                      >
                        <svg {...ICON_PROPS}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        aria-label={`Supprimer ${rowLabel(item)}`}
                        title="Supprimer"
                        className="p-2 rounded-lg text-terre-cuite hover:bg-terre-cuite/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terre-cuite transition-colors"
                      >
                        <svg {...ICON_PROPS}><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
