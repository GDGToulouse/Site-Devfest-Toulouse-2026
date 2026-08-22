import type { ScheduleRow, ScheduleTalk } from "@/lib/schedule";
import type { ScheduleRoom } from "@/lib/types";
import { formatEventTime } from "@/lib/datetime";
import { localizedField } from "@/lib/i18n-helpers";
import type { PrintGrouping } from "@/lib/print";

export interface PrintLabels {
  /** "DevFest Toulouse 2026" */
  title: string;
  /** Date and venue, already assembled by the page. */
  subtitle: string;
  /** Where to read the details — printed, not linked. */
  source: string;
  /** Shown instead of the whole programme when a selection is printed. */
  selectionNote: string;
  roomTba: string;
  /** "Retransmission" (#456), shown beside a talk on a room it is relayed to. */
  simulcast: string;
  common: string;
}

interface ProgrammePrintProps {
  rows: ScheduleRow[];
  rooms: ScheduleRoom[];
  grouping: PrintGrouping;
  locale: string;
  formatLabels: Record<string, string>;
  labels: PrintLabels;
  isSelection: boolean;
}

// The document that comes out of the printer (#449).
//
// Not the screen with its chrome removed: a separate rendering, on the same
// rows. Paper has no hover, no link, no colour worth relying on and no room for
// cards — it wants lines, a hierarchy and a header that says what this sheet is
// once it has left the browser.
//
// It exists only in print: `display: none` on screen, so nothing here is in the
// accessibility tree of the live page and the grid stays the only thing a
// screen reader meets.
export default function ProgrammePrint({
  rows,
  rooms,
  grouping,
  locale,
  formatLabels,
  labels,
  isSelection,
}: ProgrammePrintProps) {
  return (
    <div className="print-only" aria-hidden>
      {/* A <div>, not a <header>: the print stylesheet hides every `header` on
          the page as site chrome, and this one vanished with it — the first
          sheet came out with no title at all. Seen in the PDF, nowhere else. */}
      <div className="print-head">
        <h2>{labels.title}</h2>
        <p>{labels.subtitle}</p>
        {isSelection && <p className="print-note">{labels.selectionNote}</p>}
        <p className="print-source">{labels.source}</p>
      </div>

      {grouping === "time" ? (
        <ByTime rows={rows} rooms={rooms} locale={locale} formatLabels={formatLabels} labels={labels} />
      ) : (
        <ByRoom rows={rows} rooms={rooms} locale={locale} formatLabels={formatLabels} labels={labels} />
      )}
    </div>
  );
}

/** The day in order — what a participant folds into a pocket. */
function ByTime({
  rows,
  rooms,
  locale,
  formatLabels,
  labels,
}: Omit<ProgrammePrintProps, "grouping" | "isSelection">) {
  return (
    <div>
      {rows.map((row) =>
        row.type === "band" ? (
          <p key={row.key} className="print-band">
            <span className="print-time">
              {formatEventTime(row.entry.startsAt)} – {formatEventTime(row.entry.endsAt)}
            </span>{" "}
            {localizedField(row.entry, "label", locale)}
          </p>
        ) : (
          <section key={row.key} className="print-slot">
            <h3>{formatEventTime(row.startsAt)}</h3>
            <ul>
              {row.cells.flatMap((cells, index) =>
                // By hour, the keynote is one line, not one per relay room.
                cells
                  .filter((cell) => !cell.isSimulcast)
                  .map(({ talk }) => (
                  <PrintedSession
                    key={talk.slug}
                    talk={talk}
                    locale={locale}
                    formatLabels={formatLabels}
                    aside={rooms[index]?.name || labels.roomTba}
                  />
                )),
              )}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

/**
 * One section per room — a sheet to pin on each door.
 *
 * The same rows read down the columns instead of across them. The shared
 * moments belong to no room: they are gathered once at the end rather than
 * repeated under every door.
 */
function ByRoom({
  rows,
  rooms,
  locale,
  formatLabels,
  labels,
}: Omit<ProgrammePrintProps, "grouping" | "isSelection">) {
  // By room, a relay does belong on the page: someone reading the Agora sheet
  // needs to know the keynote plays there (#456).
  const perRoom = rooms.map((_, index) =>
    rows.flatMap((row) => (row.type === "slot" ? (row.cells[index] ?? []) : [])),
  );
  const bands = rows.filter((row) => row.type === "band");

  return (
    <div>
      {rooms.map((room, index) =>
        perRoom[index].length === 0 ? null : (
          <section key={room.id ?? `label:${room.name}`} className="print-room">
            <h3>{room.name || labels.roomTba}</h3>
            {/* Each room starts its own sheet, and a sheet pinned on a door has
                to name its event: only the first page carries the document
                header. */}
            <p className="print-room-sub">
              {labels.title} — {labels.subtitle}
            </p>
            <ul>
              {perRoom[index].map(({ talk, isSimulcast }) => (
                <PrintedSession
                  key={talk.slug}
                  talk={talk}
                  locale={locale}
                  formatLabels={formatLabels}
                  aside={`${formatEventTime(talk.startsAt)}${
                    talk.endsAt ? ` – ${formatEventTime(talk.endsAt)}` : ""
                  }${isSimulcast ? ` · ${labels.simulcast}` : ""}`}
                />
              ))}
            </ul>
          </section>
        ),
      )}

      {bands.length > 0 && (
        <section className="print-room">
          <h3>{labels.common}</h3>
          <ul>
            {bands.map((row) =>
              row.type === "band" ? (
                <li key={row.key}>
                  <span className="print-time">
                    {formatEventTime(row.entry.startsAt)} – {formatEventTime(row.entry.endsAt)}
                  </span>
                  <span className="print-title">{localizedField(row.entry, "label", locale)}</span>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function PrintedSession({
  talk,
  locale,
  formatLabels,
  aside,
}: {
  talk: ScheduleTalk;
  locale: string;
  formatLabels: Record<string, string>;
  aside: string;
}) {
  const category = talk.category ? localizedField(talk.category, "name", locale) : null;
  // One line of context instead of the screen's coloured pills: colour does not
  // survive a black-and-white printer, so what it carried becomes words.
  const meta = [formatLabels[talk.format], category, talk.language.toUpperCase()]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <span className="print-time">{aside}</span>
      <span className="print-title">{talk.title}</span>
      {talk.speakers.length > 0 && (
        <span className="print-speakers">{talk.speakers.map((s) => s.name).join(", ")}</span>
      )}
      <span className="print-meta">{meta}</span>
    </li>
  );
}
