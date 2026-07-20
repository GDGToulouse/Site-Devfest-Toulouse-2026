"use client";

import { useMemo, useState } from "react";

import { useRouter, usePathname } from "@/i18n/navigation";
import type { EditionTalk, TalkFormat, TalkLevel } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";
import ConferencesList from "./ConferencesList";

const FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"];
const LEVELS: TalkLevel[] = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"];

export interface CategoryOption {
  slug: string;
  label: string;
}

interface Labels {
  search: string;
  filters: string;
  format: string;
  level: string;
  language: string;
  category: string;
  moreFilters: string;
  reset: string;
  noResults: string;
  sessions: string; // plural noun, composed as "{n} {sessions}"
  formatLabels: Record<string, string>;
  levelLabels: Record<string, string>;
  languageLabels: Record<string, string>; // { fr, en }
}

interface Filters {
  q: string;
  format: string;
  level: string;
  language: string;
  category: string;
}

interface ConferencesBrowserProps {
  talks: EditionTalk[];
  locale: string;
  categories: CategoryOption[];
  languages: string[];
  labels: Labels;
  initial: Filters;
}

// Client layer over the SSR-rendered list (#107): search + toggleable chips
// for format / level / language / category, with the active selection mirrored
// into the URL querystring so a filtered view is shareable and survives reload.
export default function ConferencesBrowser({
  talks,
  locale,
  categories,
  languages,
  labels,
  initial,
}: ConferencesBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<Filters>(initial);
  // Level + language live behind a "more filters" disclosure to keep the bar
  // compact (#246). Open it on mount if one of them was already active via URL.
  const [showMore, setShowMore] = useState(Boolean(initial.level || initial.language));
  // On mobile the whole filter panel is collapsed behind a "Filters" button to
  // keep the session list above the fold (#256); desktop always shows it. Open
  // on mount when a filter is already active via URL so a shared link is clear.
  const [showPanel, setShowPanel] = useState(
    Boolean(initial.q || initial.format || initial.level || initial.language || initial.category),
  );

  // Toggle a chip (empty value clears it) and reflect the whole filter state in
  // the URL. replace (not push) so the back button doesn't step through every
  // chip click. scroll:false keeps the viewport where the user is filtering.
  function update(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.format) params.set("format", merged.format);
    if (merged.level) params.set("level", merged.level);
    if (merged.language) params.set("language", merged.language);
    if (merged.category) params.set("category", merged.category);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggle(key: keyof Filters, value: string) {
    update({ [key]: filters[key] === value ? "" : value } as Partial<Filters>);
  }

  const hasActiveFilter =
    Boolean(filters.q || filters.format || filters.level || filters.language || filters.category);

  // Only families actually rendered inside the disclosure count toward its badge.
  const hasLanguageFilter = languages.length > 1;
  const collapsedActiveCount =
    (filters.level ? 1 : 0) + (hasLanguageFilter && filters.language ? 1 : 0);

  // Total active filters — the badge on the mobile "Filters" button so the user
  // knows a filter is applied even while the panel is collapsed.
  const activeFilterCount =
    (filters.q ? 1 : 0) +
    (filters.format ? 1 : 0) +
    (filters.level ? 1 : 0) +
    (hasLanguageFilter && filters.language ? 1 : 0) +
    (filters.category ? 1 : 0);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return talks.filter((talk) => {
      if (filters.format && talk.format !== filters.format) return false;
      if (filters.level && talk.level !== filters.level) return false;
      if (filters.language && talk.language !== filters.language) return false;
      if (filters.category) {
        const cat = talk.category ? localizedField(talk.category, "name", locale) : "";
        // Categories carry no slug on the public payload; match on the localized
        // name we surfaced as the chip value.
        if (cat !== filters.category) return false;
      }
      if (q) {
        const title = talk.title.toLowerCase();
        const speakers = talk.speakers.map((s) => s.name).join(" ").toLowerCase();
        if (!title.includes(q) && !speakers.includes(q)) return false;
      }
      return true;
    });
  }, [talks, filters, locale]);

  return (
    <div>
      {/* Mobile-only trigger: the whole panel is collapsed by default (#256). */}
      <button
        type="button"
        onClick={() => setShowPanel((v) => !v)}
        aria-expanded={showPanel}
        aria-controls="conferences-filter-panel"
        className="mb-4 flex w-full items-center justify-between rounded-2xl bg-blanc px-5 py-3 text-sm font-semibold text-noir shadow-card sm:hidden"
      >
        <span className="flex items-center gap-2">
          {labels.filters}
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-malachite px-1.5 text-xs font-semibold text-blanc">
              {activeFilterCount}
            </span>
          )}
        </span>
        <span aria-hidden className={`transition-transform ${showPanel ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>

      <div
        id="conferences-filter-panel"
        className={`${showPanel ? "block" : "hidden"} space-y-4 rounded-2xl bg-blanc p-5 shadow-card sm:block`}
      >
        <input
          type="search"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder={labels.search}
          aria-label={labels.search}
          className="w-full rounded-lg border border-gris/30 px-4 py-2.5 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />

        {/* Always visible: the most discriminating families (format + track). */}
        <ChipRow label={labels.format}>
          {FORMATS.map((f) => (
            <Chip key={f} active={filters.format === f} onClick={() => toggle("format", f)}>
              {labels.formatLabels[f]}
            </Chip>
          ))}
        </ChipRow>

        {categories.length > 0 && (
          <ChipRow label={labels.category}>
            {categories.map((cat) => (
              <Chip
                key={cat.slug}
                active={filters.category === cat.label}
                onClick={() => toggle("category", cat.label)}
              >
                {cat.label}
              </Chip>
            ))}
          </ChipRow>
        )}

        {/* Secondary families (level + language) folded to keep the bar compact. */}
        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-controls="conferences-more-filters"
            className="flex items-center gap-1.5 text-sm font-medium text-bleu hover:underline"
          >
            <span
              aria-hidden
              className={`transition-transform ${showMore ? "rotate-90" : ""}`}
            >
              ›
            </span>
            {labels.moreFilters}
            {collapsedActiveCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-malachite px-1.5 text-xs font-semibold text-blanc">
                {collapsedActiveCount}
              </span>
            )}
          </button>

          {showMore && (
            <div id="conferences-more-filters" className="mt-4 space-y-4">
              <ChipRow label={labels.level}>
                {LEVELS.map((l) => (
                  <Chip key={l} active={filters.level === l} onClick={() => toggle("level", l)}>
                    {labels.levelLabels[l]}
                  </Chip>
                ))}
              </ChipRow>

              {hasLanguageFilter && (
                <ChipRow label={labels.language}>
                  {languages.map((lang) => (
                    <Chip
                      key={lang}
                      active={filters.language === lang}
                      onClick={() => toggle("language", lang)}
                    >
                      {labels.languageLabels[lang] ?? lang.toUpperCase()}
                    </Chip>
                  ))}
                </ChipRow>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gris" aria-live="polite">
            {filtered.length} {labels.sessions}
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() =>
                update({ q: "", format: "", level: "", language: "", category: "" })
              }
              className="text-sm font-medium text-bleu hover:underline"
            >
              {labels.reset}
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {filtered.length > 0 ? (
          <ConferencesList talks={filtered} locale={locale} formatLabels={labels.formatLabels} />
        ) : (
          <p className="rounded-2xl bg-blanc p-8 text-center text-gris shadow-card">
            {labels.noResults}
          </p>
        )}
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="shrink-0 text-sm font-semibold text-noir sm:w-24">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-malachite text-blanc"
          : "bg-blanc-casse text-noir hover:bg-gris/15"
      }`}
    >
      {children}
    </button>
  );
}
