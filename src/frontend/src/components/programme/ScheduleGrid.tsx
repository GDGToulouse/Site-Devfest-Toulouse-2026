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
  labels: { timeColumn: string; roomTba: string; simulcast: string };
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

// Horizontal only, and the height is left alone (#460).
//
// #455 bounded this box to `calc(100vh-5rem)` so the room row could pin to it.
// The cost was a second vertical scrollbar beside the page's own, and the pin
// it bought was never the one wanted: the row sticks to the *box*, so scrolling
// the page carried it off screen anyway — measured at `scrollY = 900`, the row
// sat at `top = -392`. Two scrollbars for a pin that only held while scrolling
// inside the box.
//
// No sticky child of this element can ever pin to the viewport. `overflow-x:
// auto` makes CSS compute `overflow-y` to `auto` too, so it is a scroll
// container whatever its height — verified twice on the page — and
// `overflow-y: clip` is normalised to `hidden` beside a scrolling axis, which
// is still a scroll container. The room row is therefore pinned by a copy that
// lives outside this box; see it below.
//
// Unbounded, the box never scrolls vertically, so only the page does. The time
// column keeps its horizontal pin, which resolves against this box and is the
// one that has to.
const GRID_VIEWPORT = "overflow-x-auto";

// `border-spacing-2` leaves 8 px of nothing between cells, and content scrolled
// under the pinned time column shows through those gaps. This lays an opaque
// backdrop that overflows the cell by half a gap on each side, and a full gap
// below, where the first row of cards arrives.
const STICKY_BACKDROP =
  "before:absolute before:-inset-x-1 before:-top-1 before:-bottom-2 before:bg-blanc before:content-['']";

// The `border-spacing-2` above, in pixels. The pinned copy of the room row has
// to account for it: the table's first row starts one gap below the table's own
// top edge, so a copy laid out from the top of the grid sat 8 px high and let
// the real row peek out underneath (#460).
const CELL_GAP = 8;

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
  const headerRow = useRef<HTMLTableRowElement>(null);
  // Whether the grid continues past each edge (#455). Eight rooms need 1616 px
  // and a 1440 px screen offers 1377: two rooms sat outside the viewport with
  // nothing at all to say so, and a visitor concluded the DevFest had six.
  const [overflow, setOverflow] = useState({ left: false, right: false });
  // What the pinned copy of the room row needs to line up with the real one
  // (#460): where the grid is scrolled to, how tall the row is, and how wide
  // each column came out. Widths are read rather than assumed — the columns are
  // laid out automatically, so a long title or a long category name decides
  // them, not `MIN_COLUMN`.
  const [header, setHeader] = useState({ scrollLeft: 0, height: 0, columns: [] as number[] });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const measure = () => {
      setOverflow({
        left: el.scrollLeft > 1,
        // A pixel of slack: fractional widths never land exactly on the end.
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });

      const row = headerRow.current;
      if (row) {
        setHeader({
          scrollLeft: el.scrollLeft,
          height: row.getBoundingClientRect().height,
          columns: [...row.children].map((cell) => cell.getBoundingClientRect().width),
        });
      }
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // The room count is not the only thing that changes the answer — filtering
    // drops columns, and the window resizes. The row is observed too: its
    // columns move when the table relayouts, even at a constant box width.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (headerRow.current) observer.observe(headerRow.current);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [rooms.length, rows.length]);

  return (
    // `-mx-6` cancels the page's own `px-6` for the grid alone (#460): eight
    // rooms need 1616 px and a 1650 px window offered 1572, so it scrolled by
    // 44 px on a screen wide enough to hold it. Everything else on the page
    // stays aligned with the rest of the site. The table's `border-spacing`
    // still leaves 8 px between the cards and the window edge, so full bleed
    // does not mean flush. Below 1646 px the grid scrolls regardless — that is
    // the #441 trade, readability over compression.
    <div className="print-grid relative -mx-6 hidden lg:block">
      {/* The room row, pinned to the viewport (#460).

          A copy, because the real one cannot be: it lives inside a horizontal
          scroll container, and a sticky child of one resolves against that box
          rather than the page. This copy lives outside it, so its `top` means
          what it says.

          52px, not the site header's 60: the box carries one `border-spacing`
          of lead above its pills, so pinning at 52 puts the pills themselves at
          60, flush under the header, and tucks that lead behind it. The header
          keeps z-40 and paints over. That lead has to be hidden now the box is
          transparent, or the row scrolling underneath shows through it as a
          strip of cut-off text.

          `h-0` keeps it out of the flow: it takes no space, and its child
          paints downward over the real row, which it covers exactly. There is
          therefore nothing to show or hide as the page scrolls — the copy is
          always exactly where the real row would be, or pinned under the
          header once that has scrolled past. Sticky stops at the bottom of
          this container, so it never outlives its own grid.

          Hidden from assistive technology: the real `<th scope="col">` cells
          underneath are what announce a cell's room, scrolled or not. */}
      {header.columns.length > 0 && (
        <div aria-hidden className="sticky top-[52px] z-20 h-0">
          {/* No background of its own (#460): the pills are opaque, and an
              opaque strip behind them hid the row passing underneath in the
              8 px between each one. Only the hour cell below stays opaque — it
              is pinned across the horizontal scroll, and the room pills would
              otherwise slide visibly under its label. */}
          <div
            className="relative overflow-hidden"
            style={{ height: header.height + CELL_GAP }}
          >
            <div
              className="flex items-center gap-2 px-2 pt-2"
              style={{ transform: `translateX(${-header.scrollLeft}px)` }}
            >
              {/* Placeholder for the hour column: the real label is painted on
                  top of it, unmoved, so it stays put as the rooms slide by. */}
              <div style={{ width: header.columns[0], flex: "0 0 auto" }} />
              {rooms.map((room, index) => (
                <div
                  key={room.id ?? `label:${room.name}`}
                  style={{ width: header.columns[index + 1], flex: "0 0 auto" }}
                  className="rounded-2xl bg-blanc-casse px-3 py-2 text-left text-sm font-bold text-noir"
                >
                  {room.name || labels.roomTba}
                </div>
              ))}
            </div>
            <div
              className="absolute bottom-0 left-0 top-2 flex items-center bg-blanc pl-2 text-sm font-bold text-gris"
              style={{ width: header.columns[0] + CELL_GAP * 2 }}
            >
              {labels.timeColumn}
            </div>
          </div>
        </div>
      )}

      {/* Scrolls inside its own box: the page body must never scroll sideways. */}
      <div ref={scroller} className={GRID_VIEWPORT}>
        <table className="w-full border-separate border-spacing-2">
          <thead>
            <tr ref={headerRow}>
              {/* Pinned horizontally, and above the room row it crosses: the
                  hour stays readable however far right you have scrolled.
                  Opaque, or cards slide visibly under. */}
              <th
                scope="col"
                className={`sticky left-0 z-30 w-24 min-w-24 bg-blanc text-left text-sm font-bold text-gris ${STICKY_BACKDROP}`}
              >
                <span className="relative">{labels.timeColumn}</span>
              </th>
              {rooms.map((room) => (
                <th
                  key={room.id ?? `label:${room.name}`}
                  scope="col"
                  className={MIN_COLUMN}
                >
                  <div className="rounded-2xl bg-blanc-casse px-3 py-2 text-left text-sm font-bold text-noir">
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
                  {row.cells.map((cells, index) => (
                    // `h-px` is not a height, it is the way to give the cell one:
                    // a table cell has no resolvable height of its own, so a card
                    // asking for `h-full` inside it stays at its content size and
                    // the row ends up ragged. Declaring a nominal height makes the
                    // browser resolve it against the row it actually computed.
                    <td key={rooms[index]?.id ?? index} className={`${MIN_COLUMN} h-px align-top`}>
                      {cells.length === 0 ? (
                        // A hole in an otherwise full row reads as "the page did
                        // not finish loading" as readily as "nothing here". The
                        // dash makes the emptiness deliberate. Decorative only:
                        // an empty cell already announces as blank, and a screen
                        // reader hearing "dash" once per gap would be worse.
                        <div
                          aria-hidden
                          className="flex h-full items-center justify-center text-sm text-gris-clair/60"
                        >
                          —
                        </div>
                      ) : (
                      <div className="flex h-full flex-col gap-2">
                        {cells.map(({ talk, isSimulcast }) => (
                          <SessionCard
                            key={talk.slug}
                            talk={talk}
                            locale={locale}
                            formatLabels={formatLabels}
                            variant="grid"
                            isSimulcast={isSimulcast}
                            simulcastLabel={labels.simulcast}
                            isFavourite={favourites.has(talk.slug)}
                            onToggleFavourite={() => onToggleFavourite(talk.slug)}
                            favouriteLabels={favouriteLabels}
                          />
                        ))}
                      </div>
                      )}
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
