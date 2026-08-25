"use client";

import { useMemo, useState } from "react";

import { useRouter, usePathname } from "@/i18n/navigation";
import type { EditionSchedule } from "@/lib/types";
import { buildScheduleRows } from "@/lib/schedule";
import { serializeFavourites, toggleFavourite, type ScheduleView } from "@/lib/favourites";
import { writeStoredFavourites } from "@/lib/favourites-storage";
import { useFavouritesMemory } from "@/lib/use-favourites-memory";
import FavouritesRestoreNotice from "@/components/FavouritesRestoreNotice";
import { applyFiltersToParams, matchesFilters, type TalkFilters } from "@/lib/talk-filters";
import { localizedField } from "@/lib/i18n-helpers";
import ProgrammeControls, { type ControlLabels } from "./ProgrammeControls";
import ProgrammePrint, { type PrintLabels } from "./ProgrammePrint";
import type { PrintGrouping } from "@/lib/print";
import ScheduleGrid from "./ScheduleGrid";
import ScheduleAgenda from "./ScheduleAgenda";

interface Labels extends ControlLabels {
  timeColumn: string;
  roomTba: string;
  simulcast: string;
  favouriteAdd: string;
  favouriteRemove: string;
  empty: string;
  noResults: string;
  exportAllTitle: string;
  exportMineTitle: string;
  print: PrintLabels;
}

interface ProgrammeBrowserProps {
  schedule: EditionSchedule;
  locale: string;
  formatLabels: Record<string, string>;
  labels: Labels;
  initialFavourites: string[];
  initialView: ScheduleView;
  initialFilters: TalkFilters;
  initialPrintGrouping: PrintGrouping;
}

// The interactive layer over the schedule (#442, #448).
//
// It owns the selection, the view and the filters, and mirrors all three into
// the querystring — the same mechanism as the session filters (#107). Two
// consequences worth keeping in mind:
//
//   - the filtering happens here, in the browser, on the payload the server
//     already rendered. The HTML is identical for every visitor, so the page
//     stays cacheable instead of forking into one variant per combination;
//   - `replace`, never `push`: with `push` the back button would walk back
//     through every star and every chip the visitor clicked.
export default function ProgrammeBrowser({
  schedule,
  locale,
  formatLabels,
  labels,
  initialFavourites,
  initialView,
  initialFilters,
  initialPrintGrouping,
}: ProgrammeBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [favourites, setFavourites] = useState<string[]>(initialFavourites);
  const [view, setView] = useState<ScheduleView>(initialView);
  const [filters, setFilters] = useState<TalkFilters>(initialFilters);
  const [printGrouping, setPrintGrouping] = useState<PrintGrouping>(initialPrintGrouping);

  function syncUrl(
    nextFavourites: string[],
    nextView: ScheduleView,
    nextFilters: TalkFilters,
    nextPrint: PrintGrouping = printGrouping,
  ) {
    const params = new URLSearchParams();
    const fav = serializeFavourites(nextFavourites);
    if (fav) params.set("fav", fav);
    if (nextView !== "all") params.set("view", nextView);
    if (nextPrint !== "time") params.set("print", nextPrint);
    applyFiltersToParams(params, nextFilters);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Remembered locally as well as put in the URL (#461). The URL stays the
  // shareable truth; the store is only what survives clicking away in the menu
  // and coming back without the querystring.
  const { superseded, dismiss } = useFavouritesMemory(
    schedule.year,
    initialFavourites,
    (stored) => {
      setFavourites(stored);
      syncUrl(stored, view, filters);
    },
  );

  function onToggleFavourite(slug: string) {
    const next = toggleFavourite(favourites, slug);
    setFavourites(next);
    writeStoredFavourites(schedule.year, next);
    syncUrl(next, view, filters);
  }

  function restoreSuperseded() {
    if (!superseded) return;
    setFavourites(superseded);
    writeStoredFavourites(schedule.year, superseded);
    syncUrl(superseded, view, filters);
    dismiss();
  }

  function onChangeView(next: ScheduleView) {
    setView(next);
    syncUrl(favourites, next, filters);
  }

  function onChangeFilters(next: Partial<TalkFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    syncUrl(favourites, view, merged);
  }

  // One handler rather than the two calls in a row the reset button used to
  // make (#460): each writes the URL from its own closure, so the second one
  // rebuilt the query string from a `filters` React had not updated yet and put
  // the category back that the first had just removed.
  function onReset() {
    const cleared = { ...filters, format: "", level: "", language: "", category: "" };
    setFilters(cleared);
    setView("all");
    syncUrl(favourites, "all", cleared);
  }

  const selected = useMemo(() => new Set(favourites), [favourites]);

  // Filtering the payload rather than the rows: the row builder then recomputes
  // the columns too, so a filter that empties a room drops its column instead of
  // leaving eight mostly-blank ones. Rows and columns come out of the same call
  // — they index into each other and must never be derived apart.
  const { rows, rooms, matched } = useMemo(() => {
    const talks = schedule.talks.filter(
      (talk) =>
        matchesFilters(talk, filters, locale) && (view === "all" || selected.has(talk.slug)),
    );
    // A relay room is used too (#456): a room whose only occupation is showing
    // the keynote on a screen still needs its column, or the keynote is dropped
    // from it.
    const kept = new Set(
      talks.flatMap((talk) => [
        talk.roomId != null ? `id:${talk.roomId}` : `label:${talk.room ?? ""}`,
        ...(talk.simulcasts ?? []).map((relay) =>
          relay.roomId != null ? `id:${relay.roomId}` : `label:${relay.room ?? ""}`,
        ),
      ]),
    );
    const visibleRooms = schedule.rooms.filter((room) =>
      kept.has(room.id != null ? `id:${room.id}` : `label:${room.name}`),
    );

    return {
      rows: buildScheduleRows({
        ...schedule,
        talks,
        rooms: visibleRooms,
        // The shared moments — welcome, keynotes, breaks, lunch, the party —
        // are never starred and never filtered: they concern everyone. They
        // frame the day, unless the visitor asked for their sessions alone.
        entries: view === "mine-only" ? [] : schedule.entries,
      }),
      rooms: visibleRooms,
      matched: talks.length,
    };
  }, [schedule, selected, view, filters, locale]);

  // Only the values an edition actually uses become chips: a filter that
  // matches nothing is worse than no filter at all (#107).
  const categories = useMemo(
    () => [
      ...new Set(
        schedule.talks
          .map((talk) => (talk.category ? localizedField(talk.category, "name", locale) : ""))
          .filter(Boolean),
      ),
    ],
    [schedule.talks, locale],
  );
  const languages = useMemo(
    () => [...new Set(schedule.talks.map((talk) => talk.language).filter(Boolean))],
    [schedule.talks],
  );

  const favouriteLabels = { add: labels.favouriteAdd, remove: labels.favouriteRemove };
  // A printed sheet leaves the browser: it has to say when it is a subset, or
  // it reads as the whole programme in someone else's hands.
  const hasActiveFilters = Object.values(filters).some(Boolean);

  // The export follows what is on screen rather than adding a second control
  // that could disagree with it (#443).
  const exportsSelection = view !== "all" && favourites.length > 0;
  const icsHref = exportsSelection
    ? `/api/editions/${schedule.year}/schedule.ics?talks=${encodeURIComponent(
        serializeFavourites(favourites),
      )}`
    : `/api/editions/${schedule.year}/schedule.ics`;

  return (
    <div>
      {superseded && (
        <FavouritesRestoreNotice onRestore={restoreSuperseded} onDismiss={dismiss} />
      )}

      <ProgrammeControls
        view={view}
        onChangeView={onChangeView}
        filters={filters}
        onChangeFilters={onChangeFilters}
        onReset={onReset}
        categories={categories}
        languages={languages}
        labels={{
          ...labels,
          exportTitle: exportsSelection ? labels.exportMineTitle : labels.exportAllTitle,
        }}
        icsHref={icsHref}
        hasFavourites={favourites.length > 0}
        printGrouping={printGrouping}
        onChangePrintGrouping={(next) => {
          setPrintGrouping(next);
          syncUrl(favourites, view, filters, next);
        }}
      />

      {/* The printed document: absent from the screen, and from its
          accessibility tree, until the moment it is printed (#449). */}
      {matched > 0 && (
        <ProgrammePrint
          rows={rows}
          rooms={rooms}
          grouping={printGrouping}
          locale={locale}
          formatLabels={formatLabels}
          labels={labels.print}
          isSelection={view !== "all" || hasActiveFilters}
        />
      )}

      {/* Two different silences: nothing starred yet, or a filter that matches
          nothing. `matched` counts what survives *both*, so the two are told
          apart rather than sharing one vague sentence.
          aria-live because a chip or a view change rewrites the page under a
          screen reader that would otherwise hear no result at all. */}
      {matched === 0 ? (
        <p className="rounded-3xl bg-blanc p-6 text-lg text-gris shadow-card" aria-live="polite">
          {view !== "all" && favourites.length === 0 ? labels.empty : labels.noResults}
        </p>
      ) : (
        <>
          <ScheduleGrid
            rows={rows}
            rooms={rooms}
            locale={locale}
            formatLabels={formatLabels}
            labels={{
              timeColumn: labels.timeColumn,
              roomTba: labels.roomTba,
              simulcast: labels.simulcast,
            }}
            favourites={selected}
            onToggleFavourite={onToggleFavourite}
            favouriteLabels={favouriteLabels}
          />
          <ScheduleAgenda
            rows={rows}
            rooms={rooms}
            locale={locale}
            formatLabels={formatLabels}
            labels={{ roomTba: labels.roomTba }}
            favourites={selected}
            onToggleFavourite={onToggleFavourite}
            favouriteLabels={favouriteLabels}
          />
        </>
      )}
    </div>
  );
}
