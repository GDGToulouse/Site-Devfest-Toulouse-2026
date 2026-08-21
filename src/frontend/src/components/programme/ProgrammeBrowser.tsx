"use client";

import { useMemo, useState } from "react";

import { useRouter, usePathname } from "@/i18n/navigation";
import type { EditionSchedule } from "@/lib/types";
import { buildScheduleRows } from "@/lib/schedule";
import {
  serializeFavourites,
  toggleFavourite,
  type ScheduleView,
} from "@/lib/favourites";
import ScheduleGrid from "./ScheduleGrid";
import ScheduleAgenda from "./ScheduleAgenda";

interface Labels {
  timeColumn: string;
  roomTba: string;
  viewLabel: string;
  viewAll: string;
  viewMine: string;
  viewMineOnly: string;
  favouriteAdd: string;
  favouriteRemove: string;
  empty: string;
  exportAll: string;
  exportMine: string;
  print: string;
}

interface ProgrammeBrowserProps {
  schedule: EditionSchedule;
  locale: string;
  formatLabels: Record<string, string>;
  labels: Labels;
  initialFavourites: string[];
  initialView: ScheduleView;
}

const VIEWS: ScheduleView[] = ["all", "mine", "mine-only"];

// The interactive layer over the schedule (#442).
//
// It owns the selection and mirrors it into the querystring, the same way the
// session filters do (#107). Two consequences worth keeping in mind:
//
//   - the filtering happens here, in the browser, on the payload the server
//     already rendered. The HTML is identical for every visitor, so the page
//     stays cacheable instead of forking into one variant per selection;
//   - `replace`, never `push`: with `push` the back button would walk back
//     through every star the visitor clicked.
export default function ProgrammeBrowser({
  schedule,
  locale,
  formatLabels,
  labels,
  initialFavourites,
  initialView,
}: ProgrammeBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [favourites, setFavourites] = useState<string[]>(initialFavourites);
  const [view, setView] = useState<ScheduleView>(initialView);

  function syncUrl(nextFavourites: string[], nextView: ScheduleView) {
    const params = new URLSearchParams();
    const fav = serializeFavourites(nextFavourites);
    if (fav) params.set("fav", fav);
    if (nextView !== "all") params.set("view", nextView);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onToggleFavourite(slug: string) {
    const next = toggleFavourite(favourites, slug);
    setFavourites(next);
    syncUrl(next, view);
  }

  function onChangeView(next: ScheduleView) {
    setView(next);
    syncUrl(favourites, next);
  }

  const selected = useMemo(() => new Set(favourites), [favourites]);

  // Filtering the payload rather than the rows: the row builder then recomputes
  // the columns too, so a selection spread over three rooms draws three columns
  // instead of eight mostly-empty ones. Rows and columns come out of the same
  // call — they index into each other and must never be derived apart.
  const { rows, rooms, matched } = useMemo(() => {
    if (view === "all") {
      return { rows: buildScheduleRows(schedule), rooms: schedule.rooms, matched: 0 };
    }

    const talks = schedule.talks.filter((talk) => selected.has(talk.slug));
    const kept = new Set(
      talks.map((talk) => (talk.roomId != null ? `id:${talk.roomId}` : `label:${talk.room ?? ""}`)),
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
        // are never starred: they concern everyone. They show, or they do not.
        entries: view === "mine" ? schedule.entries : [],
      }),
      rooms: visibleRooms,
      matched: talks.length,
    };
  }, [schedule, selected, view]);

  const viewLabels: Record<ScheduleView, string> = {
    all: labels.viewAll,
    mine: labels.viewMine,
    "mine-only": labels.viewMineOnly,
  };
  const favouriteLabels = { add: labels.favouriteAdd, remove: labels.favouriteRemove };

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
      <div className="no-print mb-6 flex flex-wrap items-center gap-4">
        {/* A radio group, not three buttons: the three views are one choice, and
            a screen reader has to hear it that way. Nothing else may live inside
            it — hence the export link as a sibling. */}
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

        <a
          href={icsHref}
          className="rounded-[12px] px-2 py-2 text-sm font-bold text-bleu hover:underline focus:outline-none focus:ring-2 focus:ring-malachite/50"
        >
          {exportsSelection ? labels.exportMine : labels.exportAll}
        </a>

        {/* The printable version is the browser's own (#108): what it prints is
            this very page, minus its controls. */}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-[12px] px-2 py-2 text-sm font-bold text-bleu hover:underline focus:outline-none focus:ring-2 focus:ring-malachite/50"
        >
          {labels.print}
        </button>
      </div>

      {/* On `matched`, not on the length of the selection: a link bookmarked
          weeks ago may name only sessions that have since been cancelled, and
          showing the day's skeleton with nothing in it would explain nothing.
          aria-live because switching view changes the page under a screen
          reader that would otherwise hear no result at all. */}
      {view !== "all" && matched === 0 ? (
        <p className="rounded-3xl bg-blanc p-6 text-lg text-gris shadow-card" aria-live="polite">
          {labels.empty}
        </p>
      ) : (
        <>
          <ScheduleGrid
            rows={rows}
            rooms={rooms}
            locale={locale}
            formatLabels={formatLabels}
            labels={{ timeColumn: labels.timeColumn, roomTba: labels.roomTba }}
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
