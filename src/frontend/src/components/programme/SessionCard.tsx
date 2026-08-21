import { Link } from "@/i18n/navigation";

import type { ScheduleTalk } from "@/lib/schedule";
import { localizedField } from "@/lib/i18n-helpers";
import { formatEventTime } from "@/lib/datetime";
import FavouriteButton from "@/components/FavouriteButton";

interface SessionCardProps {
  talk: ScheduleTalk;
  locale: string;
  // Pre-resolved labels: the page owns the translation namespaces, so this stays
  // a plain server component — same arrangement as ConferencesList.
  formatLabels: Record<string, string>;
  /** Shown on the mobile agenda, where there is no column to say which room. */
  roomName?: string;
  /** Favourites (#442). Absent when the caller renders no star at all. */
  isFavourite?: boolean;
  onToggleFavourite?: () => void;
  favouriteLabels?: { add: string; remove: string };
}

// One session inside the grid (#106). The whole card is the link to its detail
// page, so the target is comfortable on a touch screen.
export default function SessionCard({
  talk,
  locale,
  formatLabels,
  roomName,
  isFavourite = false,
  onToggleFavourite,
  favouriteLabels,
}: SessionCardProps) {
  const categoryName = talk.category ? localizedField(talk.category, "name", locale) : null;
  const endsAt = talk.endsAt ? formatEventTime(talk.endsAt) : null;

  return (
    // The star lives beside the link, not inside it (#442) — a button nested in
    // an anchor is invalid markup, and one of the two clicks gets eaten.
    <div className="relative h-full">
      <Link
        href={`/conferences/${talk.slug}`}
        className="flex h-full flex-col rounded-2xl bg-blanc p-3 shadow-card transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
      >
        {/* whitespace-nowrap: at eight rooms a column is narrow enough to split
            "Cloud & DevOps" across two lines mid-label (#441). The badge wraps to
            its own line instead, and truncates only if the name is very long.
            The right padding keeps them clear of the star. */}
        <div className={`flex flex-wrap items-center gap-1.5 ${onToggleFavourite ? "pr-8" : ""}`}>
          <span className="whitespace-nowrap rounded-full bg-bleu/10 px-2 py-0.5 text-xs font-bold text-bleu">
            {formatLabels[talk.format]}
          </span>
          {categoryName && (
            <span
              className="max-w-full truncate whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold"
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

      {onToggleFavourite && favouriteLabels && (
        <FavouriteButton
          isFavourite={isFavourite}
          onToggle={onToggleFavourite}
          labels={favouriteLabels}
          className="absolute right-1 top-1"
        />
      )}
    </div>
  );
}
