import { Link } from "@/i18n/navigation";

import type { ScheduleTalk } from "@/lib/schedule";
import { localizedField } from "@/lib/i18n-helpers";
import { formatEventTime } from "@/lib/datetime";

interface SessionCardProps {
  talk: ScheduleTalk;
  locale: string;
  // Pre-resolved labels: the page owns the translation namespaces, so this stays
  // a plain server component — same arrangement as ConferencesList.
  formatLabels: Record<string, string>;
  /** Shown on the mobile agenda, where there is no column to say which room. */
  roomName?: string;
}

// One session inside the grid (#106). The whole card is the link to its detail
// page, so the target is comfortable on a touch screen.
export default function SessionCard({ talk, locale, formatLabels, roomName }: SessionCardProps) {
  const categoryName = talk.category ? localizedField(talk.category, "name", locale) : null;
  const endsAt = talk.endsAt ? formatEventTime(talk.endsAt) : null;

  return (
    <Link
      href={`/conferences/${talk.slug}`}
      className="flex h-full flex-col rounded-2xl bg-blanc p-3 shadow-card transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-bleu/10 px-2 py-0.5 text-xs font-bold text-bleu">
          {formatLabels[talk.format]}
        </span>
        {categoryName && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: `${talk.category!.color}20`, color: talk.category!.color }}
          >
            {categoryName}
          </span>
        )}
      </div>

      {/* The title is not localized (#293) — a talk is given in one language. */}
      <p className="mt-2 text-sm font-bold leading-snug text-noir">{talk.title}</p>

      {talk.speakers.length > 0 && (
        <p className="mt-1 text-xs text-gris">{talk.speakers.map((s) => s.name).join(", ")}</p>
      )}

      <p className="mt-auto pt-2 text-xs text-gris">
        {formatEventTime(talk.startsAt)}
        {endsAt ? ` – ${endsAt}` : ""}
        {roomName ? ` · ${roomName}` : ""}
      </p>
    </Link>
  );
}
