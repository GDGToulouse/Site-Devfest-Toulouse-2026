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
}

// The desktop grid (#106): rooms across, start times down.
//
// A real table, because that is what this is — the room headers and the time
// headers are what a screen reader needs to announce a cell. The mobile agenda
// renders the same data as a linear list; only one of the two is ever in the
// accessibility tree, since the other is `display: none`.
export default function ScheduleGrid({
  rows,
  rooms,
  locale,
  formatLabels,
  labels,
}: ScheduleGridProps) {
  return (
    // The grid outgrows the viewport as soon as there are five rooms, so it
    // scrolls inside its own box rather than pushing the page sideways.
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[64rem] border-separate border-spacing-2">
        <thead>
          <tr>
            <th scope="col" className="w-24 text-left text-sm font-bold text-gris">
              {labels.timeColumn}
            </th>
            {rooms.map((room) => (
              <th
                key={room.id ?? `label:${room.name}`}
                scope="col"
                className="rounded-2xl bg-blanc-casse px-3 py-2 text-left text-sm font-bold text-noir"
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
                  className="rounded-2xl bg-blanc-casse px-4 py-3 text-sm font-bold text-noir"
                >
                  <span className="text-gris">
                    {formatEventTime(row.entry.startsAt)} – {formatEventTime(row.entry.endsAt)}
                  </span>
                  <span className="ml-3">{localizedField(row.entry, "label", locale)}</span>
                </td>
              </tr>
            ) : (
              <tr key={row.key}>
                <th scope="row" className="align-top text-left text-sm font-bold text-noir">
                  {formatEventTime(row.startsAt)}
                </th>
                {row.cells.map((talks, index) => (
                  <td key={rooms[index]?.id ?? index} className="align-top">
                    <div className="flex h-full flex-col gap-2">
                      {talks.map((talk) => (
                        <SessionCard
                          key={talk.slug}
                          talk={talk}
                          locale={locale}
                          formatLabels={formatLabels}
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
