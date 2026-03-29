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
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  onEdit,
  onDelete,
  emptyMessage = "Aucun element",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <p className="text-gris py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gris/20 bg-blanc">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-blanc-casse/60 border-b border-gris/20">
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
