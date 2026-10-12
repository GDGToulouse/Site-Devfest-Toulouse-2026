"use client";

// "51–100 sur 327" with Previous / Next: holds at any volume, unlike a row of
// numbered buttons (#416). Hidden when everything fits on one page.
export default function ListPagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= limit) return null;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      <span className="text-sm text-gris">
        {first}–{last} sur {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gris/30 bg-blanc px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Précédent
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={last >= total}
          className="rounded-lg border border-gris/30 bg-blanc px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </nav>
  );
}
