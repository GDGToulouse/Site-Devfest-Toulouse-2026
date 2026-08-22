"use client";

import { useEffect, useRef, useState } from "react";

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

const ITEM =
  "w-full px-4 py-2.5 text-left text-sm font-medium text-noir hover:bg-blanc-casse focus:bg-blanc-casse focus:outline-none";

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
  exportMenu: string;
  exportMenuTitle: string;
  share: string;
  shareTitle: string;
  shareCopied: string;
  shareFailed: string;
  calendar: string;
  exportTitle: string;
  printByTimeAction: string;
  printByRoomAction: string;
  printTitle: string;
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
  // Folded at every width now (#459). It only ever folded below `sm`, so a
  // 1440 px screen carried ~200 px of chips nobody had asked for above a grid
  // that got 363. Still opens on mount when a shared link already carries a
  // filter — otherwise the visitor reads a filtered grid without being told.
  const [showPanel, setShowPanel] = useState(activeFilterCount(filters, FAMILIES) > 0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [shareState, setShareState] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  // The print document is rendered from `printGrouping`. Printing in the same
  // tick as the change would print the previous one, so the click records what
  // it wants and the effect below prints once the value has arrived.
  const [pendingPrint, setPendingPrint] = useState<PrintGrouping | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pendingPrint && printGrouping === pendingPrint) {
      setPendingPrint(null);
      window.print();
    }
  }, [pendingPrint, printGrouping]);

  // Escape and an outside click close the menu; Escape hands focus back, which
  // a pointer user does not need and a keyboard user cannot do without.
  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isMenuOpen]);

  // A success fades, a failure does not: a copy error that dismisses itself
  // reads as a copy that worked (#394).
  useEffect(() => {
    if (shareState?.kind !== "ok") return;
    const timer = setTimeout(() => setShareState(null), 4000);
    return () => clearTimeout(timer);
  }, [shareState]);

  async function share() {
    setIsMenuOpen(false);
    const url = window.location.href;
    try {
      // `navigator.share` existing does NOT mean a phone: Chrome on Windows and
      // Safari on macOS both implement it, and desktop visitors were getting an
      // OS dialog where they asked for a link — with no in-page confirmation,
      // since the sheet was supposed to be the confirmation. Measured in the
      // browser, not assumed. A coarse pointer is the capability that actually
      // matches the intent, and it is a media query rather than UA sniffing.
      const prefersNativeShare =
        typeof navigator.share === "function" &&
        (window.matchMedia?.("(pointer: coarse)").matches ?? false);

      if (prefersNativeShare) {
        // There, the sheet *is* the confirmation — a message on top of it would
        // say twice what the system already said once.
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState({ kind: "ok", text: labels.shareCopied });
    } catch (error) {
      // Dismissing the share sheet is a decision, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareState({ kind: "error", text: labels.shareFailed });
    }
  }

  function printWith(grouping: PrintGrouping) {
    setIsMenuOpen(false);
    if (printGrouping === grouping) {
      window.print();
      return;
    }
    onChangePrintGrouping(grouping);
    setPendingPrint(grouping);
  }

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
        <div className="flex flex-wrap items-center gap-3">
          {/* Outside the panel, and staying there (#459). This is not a filter
              but the view selector, and it is the whole point of favourites
              (#442): folded away with the chips, someone who starred sessions
              would have no visible way to show them on their own. */}
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

          <button
            type="button"
            onClick={() => setShowPanel((v) => !v)}
            aria-expanded={showPanel}
            aria-controls="programme-filter-panel"
            className="inline-flex items-center gap-2 rounded-[12px] bg-blanc px-4 py-2 text-sm font-bold text-noir shadow-card transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            {labels.filters}
            {/* Folded must not mean invisible: a filter is applied, and the page
                has to say so without being opened. */}
            {badge > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-malachite px-1.5 text-xs font-semibold text-blanc">
                {badge}
              </span>
            )}
            <span aria-hidden className={`transition-transform ${showPanel ? "rotate-180" : ""}`}>
              ⌄
            </span>
          </button>
        </div>

        {/* The `hidden` attribute rather than the utility class: it keeps
            aria-controls pointing at something that exists, and it is the one
            form a test environment without a stylesheet can also see. */}
        <div
          id="programme-filter-panel"
          hidden={!showPanel}
          className="mt-3 space-y-4 rounded-2xl bg-blanc p-5 shadow-card"
        >
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

            <div id="programme-more-filters" hidden={!showMore} className="mt-4 space-y-4">
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
      {/* `relative z-30` is what puts the open menu in front of the grid. The
          grid's pinned headers are positioned with a z-index of their own and
          come later in the document, so without a stacking context here they
          paint over the menu — seen in the browser, the room row cut "Partager"
          in half and swallowed "Calendrier" whole. Below the site header's
          z-40, which must keep winning. */}
      <section
        aria-label={labels.actionZone}
        className="relative z-30 flex shrink-0 flex-col items-start gap-2 lg:items-end lg:pt-1"
      >
        {/* A disclosure, not `role="menu"` (#459): the panel mixes a link with
            buttons, and the ARIA menu pattern owes the reader arrow-key roving
            it would not get here. Declared as what it is, Tab already works. */}
        <div ref={menuRef} className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-expanded={isMenuOpen}
            aria-controls="programme-export-menu"
            title={labels.exportMenuTitle}
            className="inline-flex items-center gap-2 rounded-[12px] bg-blanc px-4 py-2 text-sm font-bold text-noir shadow-card transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            {labels.exportMenu}
            <span aria-hidden className={`transition-transform ${isMenuOpen ? "rotate-180" : ""}`}>
              ⌄
            </span>
          </button>

          <div
            id="programme-export-menu"
            hidden={!isMenuOpen}
            className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl bg-blanc py-1 shadow-lg"
          >
            <button type="button" onClick={share} title={labels.shareTitle} className={ITEM}>
              {labels.share}
            </button>
            {/* A real link: the .ics is a file, and Cmd-click has to work. */}
            <a
              href={icsHref}
              title={labels.exportTitle}
              onClick={() => setIsMenuOpen(false)}
              className={`${ITEM} block`}
            >
              {labels.calendar}
            </a>
            {/* Two entries rather than a dropdown wedged inside the button
                (#449, #459): a sheet pinned on a door and a programme folded
                into a pocket are not the same document, and each entry now
                names the one it produces. */}
            <button
              type="button"
              onClick={() => printWith("time")}
              title={labels.printTitle}
              className={ITEM}
            >
              {labels.printByTimeAction}
            </button>
            <button
              type="button"
              onClick={() => printWith("room")}
              title={labels.printTitle}
              className={ITEM}
            >
              {labels.printByRoomAction}
            </button>
          </div>
        </div>

        {shareState && (
          <p
            role={shareState.kind === "ok" ? "status" : "alert"}
            aria-live={shareState.kind === "ok" ? "polite" : "assertive"}
            className={`rounded-lg px-3 py-2 text-sm ${
              shareState.kind === "ok"
                ? "bg-malachite/10 text-malachite"
                : "bg-terre-cuite/10 text-terre-cuite"
            }`}
          >
            {shareState.text}
          </p>
        )}
      </section>
    </div>
  );
}
