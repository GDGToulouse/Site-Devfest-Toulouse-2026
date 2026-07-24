import type { ReplayFilters } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";

interface ReplayFiltersBarProps {
  filters: ReplayFilters;
  locale: string;
  current: { q: string; year: string; format: string; category: string };
  labels: {
    search: string;
    searchPlaceholder: string;
    year: string;
    format: string;
    category: string;
    all: string;
    submit: string;
    reset: string;
    formatLabels: Record<string, string>;
  };
}

// A plain GET form rather than a client component: the filtered view stays a
// real URL (shareable, indexable, SSR-rendered) and keeps working without
// JavaScript. Only filter values that have replays behind them are offered.
export default function ReplayFiltersBar({ filters, locale, current, labels }: ReplayFiltersBarProps) {
  const hasActiveFilter = Boolean(current.q || current.year || current.format || current.category);

  return (
    <form method="get" className="rounded-[16px] bg-blanc p-5 shadow-card">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="replay-q" className="mb-1 block text-sm font-medium text-noir">
            {labels.search}
          </label>
          <input
            id="replay-q"
            type="search"
            name="q"
            defaultValue={current.q}
            placeholder={labels.searchPlaceholder}
            className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:border-bismarck focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="replay-year" className="mb-1 block text-sm font-medium text-noir">
            {labels.year}
          </label>
          <select
            id="replay-year"
            name="year"
            defaultValue={current.year}
            className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:border-bismarck focus:outline-none"
          >
            <option value="">{labels.all}</option>
            {filters.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="replay-format" className="mb-1 block text-sm font-medium text-noir">
            {labels.format}
          </label>
          <select
            id="replay-format"
            name="format"
            defaultValue={current.format}
            className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:border-bismarck focus:outline-none"
          >
            <option value="">{labels.all}</option>
            {filters.formats.map((format) => (
              <option key={format} value={format}>
                {labels.formatLabels[format] ?? format}
              </option>
            ))}
          </select>
        </div>

        {/* Historical talks carry no category, so the control would be an empty
            dead end on most editions — it appears only when there is something
            to pick. */}
        {filters.categories.length > 0 && (
          <div>
            <label htmlFor="replay-category" className="mb-1 block text-sm font-medium text-noir">
              {labels.category}
            </label>
            <select
              id="replay-category"
              name="category"
              defaultValue={current.category}
              className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:border-bismarck focus:outline-none"
            >
              <option value="">{labels.all}</option>
              {filters.categories.map((category) => (
                <option key={category.nameFr} value={category.nameFr}>
                  {localizedField(category, "name", locale)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-bismarck px-4 py-2 text-sm font-medium text-blanc transition-colors hover:bg-bismarck/90"
          >
            {labels.submit}
          </button>
          {hasActiveFilter && (
            <a
              href="?"
              className="rounded-lg border border-gris/30 px-4 py-2 text-sm font-medium text-gris transition-colors hover:bg-blanc-casse"
            >
              {labels.reset}
            </a>
          )}
        </div>
      </div>
    </form>
  );
}
