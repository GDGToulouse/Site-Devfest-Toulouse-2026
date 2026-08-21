import type { ScheduleRow } from "@/lib/schedule";
import type { ScheduleRoom } from "@/lib/types";
import { formatEventTime } from "@/lib/datetime";
import { localizedField } from "@/lib/i18n-helpers";
import SessionCard from "./SessionCard";

interface ScheduleGridProps {
  rows: ScheduleRow[];
  rooms: ScheduleRoom[];
  locale: string;
  formatLabels: Record<string, string>;
  labels: { timeColumn: string; roomTba: string };
  /** Favourites (#442) — passed straight down to the cards. */
  favourites: Set<string>;
  onToggleFavourite: (slug: string) => void;
  favouriteLabels: { add: string; remove: string };
}

// The desktop grid (#106): rooms across, start times down.
//
// A real table, because that is what this is — the room headers and the time
// headers are what a screen reader needs to announce a cell. The mobile agenda
// renders the same data as a linear list; only one of the two is ever in the
// accessibility tree, since the other is `display: none`.
//
// Width is per column, not per table (#441). A single `min-width` on the table
// only bites below its own value: at eight rooms the columns shared whatever
// the page offered and fell to 130 px — a title over four lines, a category
// badge cut in two. Now each room asks for MIN_COLUMN, the table grows past the
// viewport when it must, and the wrapper scrolls.
const MIN_COLUMN = "min-w-[180px]";

export default function ScheduleGrid({
  rows,
  rooms,
  locale,
  formatLabels,
  labels,
  favourites,
  onToggleFavourite,
  favouriteLabels,
}: ScheduleGridProps) {
  return (
    // Scrolls inside its own box: the page body must never scroll sideways.
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            {/* Sticky, so the hour stays readable while the rooms scroll past.
                Opaque background for the same reason — cards would otherwise
                slide under it. */}
            <th
              scope="col"
              className="sticky left-0 z-10 w-24 min-w-24 bg-blanc text-left text-sm font-bold text-gris"
            >
              {labels.timeColumn}
            </th>
            {rooms.map((room) => (
              <th
                key={room.id ?? `label:${room.name}`}
                scope="col"
                className={`${MIN_COLUMN} rounded-2xl bg-blanc-casse px-3 py-2 text-left text-sm font-bold text-noir`}
              >
                {room.name || labels.roomTba}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.type === "band" ? (
              <tr key={row.key}>
                <td
                  colSpan={rooms.length + 1}
                  className="rounded-2xl bg-blanc-casse text-sm font-bold text-noir"
                >
                  {/* The band spans every column, so its label sits at the far
                      left and scrolls out of sight with it — leaving anonymous
                      stripes across the grid. Pinning the text keeps "Déjeuner"
                      readable however far right you have scrolled. */}
                  <div className="sticky left-0 w-fit px-4 py-3">
                    <span className="text-gris">
                      {formatEventTime(row.entry.startsAt)} – {formatEventTime(row.entry.endsAt)}
                    </span>
                    <span className="ml-3">{localizedField(row.entry, "label", locale)}</span>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-24 min-w-24 bg-blanc align-top text-left text-sm font-bold text-noir"
                >
                  {formatEventTime(row.startsAt)}
                </th>
                {row.cells.map((talks, index) => (
                  // `h-px` is not a height, it is the way to give the cell one:
                  // a table cell has no resolvable height of its own, so a card
                  // asking for `h-full` inside it stays at its content size and
                  // the row ends up ragged. Declaring a nominal height makes the
                  // browser resolve it against the row it actually computed.
                  <td key={rooms[index]?.id ?? index} className={`${MIN_COLUMN} h-px align-top`}>
                    <div className="flex h-full flex-col gap-2">
                      {talks.map((talk) => (
                        <SessionCard
                          key={talk.slug}
                          talk={talk}
                          locale={locale}
                          formatLabels={formatLabels}
                          isFavourite={favourites.has(talk.slug)}
                          onToggleFavourite={() => onToggleFavourite(talk.slug)}
                          favouriteLabels={favouriteLabels}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
