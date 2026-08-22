import type { ScheduleRow } from "@/lib/schedule";
import type { ScheduleRoom } from "@/lib/types";
import { formatEventTime } from "@/lib/datetime";
import { localizedField } from "@/lib/i18n-helpers";
import SessionCard from "./SessionCard";

interface ScheduleAgendaProps {
  rows: ScheduleRow[];
  rooms: ScheduleRoom[];
  locale: string;
  formatLabels: Record<string, string>;
  labels: { roomTba: string };
  /** Favourites (#442) — passed straight down to the cards. */
  favourites: Set<string>;
  onToggleFavourite: (slug: string) => void;
  favouriteLabels: { add: string; remove: string };
}

// The same schedule read on a phone (#106): one column, chronological, each
// session carrying its room since there is no column to say it.
export default function ScheduleAgenda({
  rows,
  rooms,
  locale,
  formatLabels,
  labels,
  favourites,
  onToggleFavourite,
  favouriteLabels,
}: ScheduleAgendaProps) {
  return (
    // `print-agenda` (#108): on paper this is the schedule, whatever the width
    // of the screen it was printed from — the grid does not fit on A4. The rule
    // that swaps them lives in globals.css, not in a Tailwind `print:` variant:
    // the variant generated nothing here, and a class that produces no CSS
    // fails silently.
    <div className="print-agenda space-y-6 lg:hidden">
      {rows.map((row) =>
        row.type === "band" ? (
          <div key={row.key} className="rounded-2xl bg-blanc-casse px-4 py-3">
            <p className="text-sm font-bold text-noir">
              {localizedField(row.entry, "label", locale)}
            </p>
            <p className="mt-1 text-xs tabular-nums text-gris">
              {formatEventTime(row.entry.startsAt)} – {formatEventTime(row.entry.endsAt)}
            </p>
          </div>
        ) : (
          <section key={row.key}>
            <h2 className="text-lg font-bold tabular-nums text-noir">
              {formatEventTime(row.startsAt)}
            </h2>
            <div className="mt-3 space-y-3">
              {row.cells.flatMap((cells, index) =>
                // Relays are skipped here (#456): a linear list has no columns,
                // so drawing the keynote once per relay room would just repeat
                // it. The card names the room it is given in.
                cells
                  .filter((cell) => !cell.isSimulcast)
                  .map(({ talk }) => (
                  <SessionCard
                    key={talk.slug}
                    talk={talk}
                    locale={locale}
                    formatLabels={formatLabels}
                    roomName={rooms[index]?.name || labels.roomTba}
                    isFavourite={favourites.has(talk.slug)}
                    onToggleFavourite={() => onToggleFavourite(talk.slug)}
                    favouriteLabels={favouriteLabels}
                  />
                )),
              )}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
