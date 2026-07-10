"use client";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

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
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  onEdit,
  onDelete,
  emptyMessage = "Aucun element",
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
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
    <div className="overflow-x-auto rounded-xl shadow-card bg-blanc">
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
              <th key={col.key} className="text-left px-4 py-3 font-medium text-gris">
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
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
                <td className="px-4 py-3 text-right space-x-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      className="text-bleu hover:underline text-sm"
                    >
                      Modifier
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(item)}
                      className="text-terre-cuite hover:underline text-sm"
                    >
                      Supprimer
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
