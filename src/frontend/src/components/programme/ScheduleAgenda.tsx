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
}

// The same schedule read on a phone (#106): one column, chronological, each
// session carrying its room since there is no column to say it.
export default function ScheduleAgenda({
  rows,
  rooms,
  locale,
  formatLabels,
  labels,
}: ScheduleAgendaProps) {
  return (
    <div className="space-y-6 lg:hidden">
      {rows.map((row) =>
        row.type === "band" ? (
          <div key={row.key} className="rounded-2xl bg-blanc-casse px-4 py-3">
            <p className="text-sm font-bold text-noir">
              {localizedField(row.entry, "label", locale)}
            </p>
            <p className="mt-1 text-xs text-gris">
              {formatEventTime(row.entry.startsAt)} – {formatEventTime(row.entry.endsAt)}
            </p>
          </div>
        ) : (
          <section key={row.key}>
            <h2 className="text-lg font-bold text-noir">{formatEventTime(row.startsAt)}</h2>
            <div className="mt-3 space-y-3">
              {row.cells.flatMap((talks, index) =>
                talks.map((talk) => (
                  <SessionCard
                    key={talk.slug}
                    talk={talk}
                    locale={locale}
                    formatLabels={formatLabels}
                    roomName={rooms[index]?.name || labels.roomTba}
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
