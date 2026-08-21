"use client";

import { useState } from "react";

import { Chip, ChipRow } from "@/components/FilterChip";
import { activeFilterCount, type TalkFilters } from "@/lib/talk-filters";
import type { ScheduleView } from "@/lib/favourites";
import type { PrintGrouping } from "@/lib/print";
import type { TalkFormat, TalkLevel } from "@/lib/types";

const FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"];
const LEVELS: TalkLevel[] = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"];
const VIEWS: ScheduleView[] = ["all", "mine", "mine-only"];

// Families offered here — no free-text search on the grid, so `q` never counts
// toward the badge (#448).
const FAMILIES: (keyof TalkFilters)[] = ["format", "category", "level", "language"];

export interface ControlLabels {
  filterZone: string;
  actionZone: string;
  filters: string;
  reset: string;
  format: string;
  level: string;
  language: string;
  category: string;
  moreFilters: string;
  viewLabel: string;
  viewAll: string;
  viewMine: string;
  viewMineOnly: string;
  formatLabels: Record<string, string>;
  levelLabels: Record<string, string>;
  languageLabels: Record<string, string>;
  exportShort: string;
  exportTitle: string;
  printShort: string;
  printTitle: string;
  printGroupingLabel: string;
  printByTime: string;
  printByRoom: string;
}

interface ProgrammeControlsProps {
  view: ScheduleView;
  onChangeView: (view: ScheduleView) => void;
  filters: TalkFilters;
  onChangeFilters: (next: Partial<TalkFilters>) => void;
  categories: string[];
  languages: string[];
  labels: ControlLabels;
  icsHref: string;
  printGrouping: PrintGrouping;
  onChangePrintGrouping: (grouping: PrintGrouping) => void;
}

// Everything above the grid, in two zones (#448): what filters it, and what
// acts on it.
//
// They looked alike before — a radio group and two sentences in blue — and
// nothing said that one changes the view while the other downloads a file.
export default function ProgrammeControls({
  view,
  onChangeView,
  filters,
  onChangeFilters,
  categories,
  languages,
  labels,
  icsHref,
  printGrouping,
  onChangePrintGrouping,
}: ProgrammeControlsProps) {
  // Same two disclosures as the session list (#246, #256): level and language
  // behind "more filters", and the whole panel collapsed on mobile. Open on
  // mount when a shared link already carries a filter, or the visitor cannot
  // see what is being applied.
  const [showMore, setShowMore] = useState(Boolean(filters.level || filters.language));
  const [showPanel, setShowPanel] = useState(activeFilterCount(filters, FAMILIES) > 0);

  const hasLanguageFilter = languages.length > 1;
  const badge = activeFilterCount(filters, hasLanguageFilter ? FAMILIES : ["format", "category", "level"]);
  const collapsedCount =
    (filters.level ? 1 : 0) + (hasLanguageFilter && filters.language ? 1 : 0);

  function toggle(key: keyof TalkFilters, value: string) {
    onChangeFilters({ [key]: filters[key] === value ? "" : value });
  }

  const viewLabels: Record<ScheduleView, string> = {
    all: labels.viewAll,
    mine: labels.viewMine,
    "mine-only": labels.viewMineOnly,
  };

  return (
    // no-print: a control on paper is noise (#108).
    <div className="no-print mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      {/* ---- Filtrer ---- */}
      <section aria-label={labels.filterZone} className="flex-1">
        <button
          type="button"
          onClick={() => setShowPanel((v) => !v)}
          aria-expanded={showPanel}
          aria-controls="programme-filter-panel"
          className="mb-3 flex w-full items-center justify-between rounded-2xl bg-blanc px-5 py-3 text-sm font-semibold text-noir shadow-card sm:hidden"
        >
          <span className="flex items-center gap-2">
            {labels.filters}
            {badge > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-malachite px-1.5 text-xs font-semibold text-blanc">
                {badge}
              </span>
            )}
          </span>
          <span aria-hidden className={`transition-transform ${showPanel ? "rotate-180" : ""}`}>
            ⌄
          </span>
        </button>

        <div
          id="programme-filter-panel"
          className={`${showPanel ? "block" : "hidden"} space-y-4 rounded-2xl bg-blanc p-5 shadow-card sm:block`}
        >
          {/* The view selector is a radio group and may hold nothing but its
              three radios — the filters are its neighbours, not its children. */}
          <div
            role="radiogroup"
            aria-label={labels.viewLabel}
            className="inline-flex flex-wrap gap-2 rounded-2xl bg-blanc-casse p-1"
          >
            {VIEWS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => onChangeView(value)}
                className={`rounded-[12px] px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-malachite/50 ${
                  view === value ? "bg-blanc text-noir shadow-card" : "text-gris hover:text-noir"
                }`}
              >
                {viewLabels[value]}
              </button>
            ))}
          </div>

          <ChipRow label={labels.format}>
            {FORMATS.map((format) => (
              <Chip
                key={format}
                active={filters.format === format}
                onClick={() => toggle("format", format)}
              >
                {labels.formatLabels[format]}
              </Chip>
            ))}
          </ChipRow>

          {categories.length > 0 && (
            <ChipRow label={labels.category}>
              {categories.map((category) => (
                <Chip
                  key={category}
                  active={filters.category === category}
                  onClick={() => toggle("category", category)}
                >
                  {category}
                </Chip>
              ))}
            </ChipRow>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              aria-controls="programme-more-filters"
              className="flex items-center gap-1.5 text-sm font-medium text-bleu hover:underline"
            >
              <span aria-hidden>{showMore ? "⌄" : "›"}</span>
              {labels.moreFilters}
              {!showMore && collapsedCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-malachite px-1.5 text-xs font-semibold text-blanc">
                  {collapsedCount}
                </span>
              )}
            </button>

            <div id="programme-more-filters" className={`${showMore ? "mt-4 space-y-4" : "hidden"}`}>
              <ChipRow label={labels.level}>
                {LEVELS.map((level) => (
                  <Chip
                    key={level}
                    active={filters.level === level}
                    onClick={() => toggle("level", level)}
                  >
                    {labels.levelLabels[level]}
                  </Chip>
                ))}
              </ChipRow>

              {/* Only when the edition actually has two — a filter that matches
                  everything is a filter that helps nobody. */}
              {hasLanguageFilter && (
                <ChipRow label={labels.language}>
                  {languages.map((language) => (
                    <Chip
                      key={language}
                      active={filters.language === language}
                      onClick={() => toggle("language", language)}
                    >
                      {labels.languageLabels[language] ?? language.toUpperCase()}
                    </Chip>
                  ))}
                </ChipRow>
              )}
            </div>
          </div>

          {badge > 0 && (
            <button
              type="button"
              onClick={() =>
                onChangeFilters({ format: "", level: "", language: "", category: "" })
              }
              className="text-sm font-medium text-bleu hover:underline"
            >
              {labels.reset}
            </button>
          )}
        </div>
      </section>

      {/* ---- Agir ---- */}
      <section
        aria-label={labels.actionZone}
        className="flex shrink-0 flex-wrap items-center gap-3 lg:pt-1"
      >
        {/* Short on the button, the whole sentence in the tooltip *and* in the
            accessible name: `title` alone is announced by almost nothing, and a
            visible label must be contained in the accessible one or voice
            control cannot say "Exporter". */}
        <a
          href={icsHref}
          title={labels.exportTitle}
          aria-label={labels.exportTitle}
          className="rounded-[12px] bg-blanc px-4 py-2 text-sm font-bold text-noir shadow-card transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
        >
          {labels.exportShort}
        </a>
        {/* The grouping is chosen before printing, not after (#449): a sheet
            pinned on a door and a programme folded into a pocket are not the
            same document. */}
        <span className="inline-flex items-center gap-2 rounded-[12px] bg-blanc px-2 py-1 shadow-card">
          <button
            type="button"
            onClick={() => window.print()}
            title={labels.printTitle}
            aria-label={labels.printTitle}
            className="rounded-[12px] px-2 py-1 text-sm font-bold text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            {labels.printShort}
          </button>
          <select
            value={printGrouping}
            onChange={(event) => onChangePrintGrouping(event.target.value as PrintGrouping)}
            aria-label={labels.printGroupingLabel}
            className="rounded-[12px] bg-blanc-casse px-2 py-1 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            <option value="time">{labels.printByTime}</option>
            <option value="room">{labels.printByRoom}</option>
          </select>
        </span>
      </section>
    </div>
  );
}
