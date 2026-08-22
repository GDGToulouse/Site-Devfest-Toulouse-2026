import { useEffect, useRef, useState } from "react";

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

// Pinning the room row took a scroll container of our own, and that is not a
// stylistic preference (#455).
//
// The obvious fix — `sticky top-[60px]`, parking the row under the site header —
// cannot work here. `overflow-x: auto` on the wrapper makes CSS compute
// `overflow-y` to `auto` as well, so the wrapper *is* a scroll container, and a
// sticky child resolves against it rather than the viewport. Measured on the
// page: the row scrolled away exactly as before. `overflow-y: clip` does not
// save it either — next to a scrolling axis it is normalised to `hidden`, which
// is still a scroll container.
//
// So the grid scrolls inside a box of its own, bounded to the viewport, and the
// headers pin to that box on both axes. The page keeps its own scroll for
// everything around it.
const GRID_VIEWPORT = "max-h-[calc(100vh-5rem)] overflow-auto";

// `border-spacing-2` leaves 8 px of nothing between cells, and scrolled content
// shows through those gaps behind a sticky header. This lays an opaque backdrop
// that overflows the cell by half a gap on each side, and a full gap below,
// where the first row of cards arrives.
const STICKY_BACKDROP =
  "before:absolute before:-inset-x-1 before:-top-1 before:-bottom-2 before:bg-blanc before:content-['']";

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
  const scroller = useRef<HTMLDivElement>(null);
  // Whether the grid continues past each edge (#455). Eight rooms need 1616 px
  // and a 1440 px screen offers 1377: two rooms sat outside the viewport with
  // nothing at all to say so, and a visitor concluded the DevFest had six.
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const measure = () =>
      setOverflow({
        left: el.scrollLeft > 1,
        // A pixel of slack: fractional widths never land exactly on the end.
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // The room count is not the only thing that changes the answer — filtering
    // drops columns, and the window resizes.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [rooms.length, rows.length]);

  return (
    <div className="print-grid relative hidden lg:block">
      {/* Scrolls inside its own box: the page body must never scroll sideways. */}
      <div ref={scroller} className={GRID_VIEWPORT}>
        <table className="w-full border-separate border-spacing-2">
          <thead>
            <tr>
              {/* Sticky on both axes, and above the room row it crosses: the
                  hour stays readable while the rooms scroll past, the rooms
                  while the hours do. Opaque, or cards slide visibly under. */}
              <th
                scope="col"
                className={`sticky left-0 top-0 z-30 w-24 min-w-24 bg-blanc text-left text-sm font-bold text-gris ${STICKY_BACKDROP}`}
              >
                <span className="relative">{labels.timeColumn}</span>
              </th>
              {rooms.map((room) => (
                <th
                  key={room.id ?? `label:${room.name}`}
                  scope="col"
                  className={`${MIN_COLUMN} sticky top-0 z-20 ${STICKY_BACKDROP}`}
                >
                  {/* The pill is an inner box so the backdrop above can sit
                      behind it without swallowing its rounded corners. */}
                  <div className="relative rounded-2xl bg-blanc-casse px-3 py-2 text-left text-sm font-bold text-noir">
                    {room.name || labels.roomTba}
                  </div>
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
                      <span className="tabular-nums text-gris">
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
                    className={`sticky left-0 z-10 w-24 min-w-24 bg-blanc align-top text-left text-sm font-bold tabular-nums text-noir transition-shadow ${
                      overflow.left ? "shadow-[8px_0_8px_-6px_rgba(29,29,27,0.25)]" : ""
                    }`}
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
                            variant="grid"
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

      {/* The one thing that says there is more to the right (#455). Decorative:
          the table itself is complete in the accessibility tree, scrolled or
          not, so this is for the eye only. */}
      {overflow.right && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-blanc via-blanc/80 to-transparent"
        />
      )}
    </div>
  );
}
