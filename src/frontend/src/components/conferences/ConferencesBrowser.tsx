"use client";

import { useMemo, useState } from "react";

import { useRouter, usePathname } from "@/i18n/navigation";
import type { EditionTalk, TalkFormat, TalkLevel } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";
import ConferencesList from "./ConferencesList";

const FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE"];
const LEVELS: TalkLevel[] = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"];

export interface CategoryOption {
  slug: string;
  label: string;
}

interface Labels {
  search: string;
  format: string;
  level: string;
  language: string;
  category: string;
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
        const title = localizedField(talk, "title", locale).toLowerCase();
        const speakers = talk.speakers.map((s) => s.name).join(" ").toLowerCase();
        if (!title.includes(q) && !speakers.includes(q)) return false;
      }
      return true;
    });
  }, [talks, filters, locale]);

  return (
    <div>
      <div className="space-y-4 rounded-2xl bg-blanc p-5 shadow-card">
        <input
          type="search"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder={labels.search}
          aria-label={labels.search}
          className="w-full rounded-lg border border-gris/30 px-4 py-2.5 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />

        <ChipRow label={labels.format}>
          {FORMATS.map((f) => (
            <Chip key={f} active={filters.format === f} onClick={() => toggle("format", f)}>
              {labels.formatLabels[f]}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label={labels.level}>
          {LEVELS.map((l) => (
            <Chip key={l} active={filters.level === l} onClick={() => toggle("level", l)}>
              {labels.levelLabels[l]}
            </Chip>
          ))}
        </ChipRow>

        {languages.length > 1 && (
          <ChipRow label={labels.language}>
            {languages.map((lang) => (
              <Chip key={lang} active={filters.language === lang} onClick={() => toggle("language", lang)}>
                {labels.languageLabels[lang] ?? lang.toUpperCase()}
              </Chip>
            ))}
          </ChipRow>
        )}

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
