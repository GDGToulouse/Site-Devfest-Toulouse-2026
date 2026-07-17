"use client";

import { useRouter, usePathname } from "@/i18n/navigation";

interface EditionOption {
  year: number;
  label: string;
}

interface TagOption {
  slug: string;
  name: string;
}

interface Labels {
  edition: string;
  allEditions: string;
  tags: string;
  reset: string;
}

interface ArticlesFiltersProps {
  editions: EditionOption[];
  tags: TagOption[];
  activeEdition: number | null;
  activeTag: string | null;
  labels: Labels;
}

// Client filter bar over the SSR articles list (#179): an edition <select> and
// clickable tag chips, both mirrored into the URL so a filtered view is
// shareable. Changing any filter drops the page number (back to page 1).
export default function ArticlesFilters({
  editions,
  tags,
  activeEdition,
  activeTag,
  labels,
}: ArticlesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: { edition?: number | null; tag?: string | null }) {
    const edition = next.edition !== undefined ? next.edition : activeEdition;
    const tag = next.tag !== undefined ? next.tag : activeTag;
    const params = new URLSearchParams();
    if (edition) params.set("edition", String(edition));
    if (tag) params.set("tag", tag);
    // No `page`: any filter change resets to the first page.
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const hasActiveFilter = Boolean(activeEdition || activeTag);

  return (
    <div className="mt-8 space-y-4 rounded-2xl bg-blanc p-5 shadow-card">
      {editions.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="edition-filter" className="shrink-0 text-sm font-semibold text-noir sm:w-24">
            {labels.edition}
          </label>
          <select
            id="edition-filter"
            value={activeEdition ?? ""}
            onChange={(e) => apply({ edition: e.target.value ? Number(e.target.value) : null })}
            className="rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            <option value="">{labels.allEditions}</option>
            {editions.map((edition) => (
              <option key={edition.year} value={edition.year}>
                {edition.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm font-semibold text-noir sm:w-24">{labels.tags}</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isActive = activeTag === tag.slug;
              return (
                <button
                  key={tag.slug}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => apply({ tag: isActive ? null : tag.slug })}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    isActive ? "bg-malachite text-blanc" : "bg-blanc-casse text-noir hover:bg-gris/15"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasActiveFilter && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => apply({ edition: null, tag: null })}
            className="text-sm font-medium text-bleu hover:underline"
          >
            {labels.reset}
          </button>
        </div>
      )}
    </div>
  );
}
