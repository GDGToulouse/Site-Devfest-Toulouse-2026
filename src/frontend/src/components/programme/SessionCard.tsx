import { Link } from "@/i18n/navigation";

import type { ScheduleTalk } from "@/lib/schedule";
import { localizedField } from "@/lib/i18n-helpers";
import { formatEventDuration, formatEventTime } from "@/lib/datetime";
import FavouriteButton from "@/components/FavouriteButton";

interface SessionCardProps {
  talk: ScheduleTalk;
  locale: string;
  // Pre-resolved labels: the page owns the translation namespaces, so this stays
  // a plain server component — same arrangement as ConferencesList.
  formatLabels: Record<string, string>;
  /**
   * What the card has room for (#457).
   *
   * `grid` is a 180 px column: it carries the category, the title, and a last
   * line of format and duration — nothing else. The start time went because the
   * row header already says it, the format badge because the same line names
   * the format in words, and the speakers because at that width they cost a
   * line the title needs more.
   *
   * `agenda` is the mobile list, where the width is not the constraint and the
   * room has to be named — there is no column to do it.
   */
  variant?: "grid" | "agenda";
  /** Shown on the mobile agenda, where there is no column to say which room. */
  roomName?: string;
  /**
   * True in a column the talk is only relayed to (#456). Same talk, same slug,
   * same favourite — the card is dimmed and captioned so the reader knows to
   * expect a screen rather than the speaker.
   */
  isSimulcast?: boolean;
  simulcastLabel?: string;
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
  variant = "agenda",
  roomName,
  isSimulcast = false,
  simulcastLabel,
  isFavourite = false,
  onToggleFavourite,
  favouriteLabels,
}: SessionCardProps) {
  const categoryName = talk.category ? localizedField(talk.category, "name", locale) : null;
  const endsAt = talk.endsAt ? formatEventTime(talk.endsAt) : null;
  const isGrid = variant === "grid";
  const duration = formatEventDuration(talk.startsAt, talk.endsAt ?? null);

  return (
    // The star lives beside the link, not inside it (#442) — a button nested in
    // an anchor is invalid markup, and one of the two clicks gets eaten.
    <div className="relative h-full">
      <Link
        href={`/conferences/${talk.slug}`}
        className={`flex h-full flex-col rounded-2xl p-3 transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50 ${
          isSimulcast
            ? "border border-dashed border-gris/40 bg-blanc-casse"
            : "bg-blanc shadow-card"
        }`}
      >
        {/* The right padding keeps the badges clear of the star.

            In the grid the category badge must be allowed to wrap (#460). Kept
            on one line, its intrinsic width becomes the column's floor: the
            table is auto-laid-out, so "Craft & Architecture" pushed its two
            columns from 180 px to 192 and widened the whole grid by 24 px. Two
            lines cost nothing; truncating would hide the half of the name that
            distinguishes it. Short names such as "Cloud & DevOps" still fit on
            one line, which is what #441 was after. */}
        <div className={`flex flex-wrap items-center gap-1.5 ${onToggleFavourite ? "pr-9" : ""}`}>
          {/* One badge in the grid, not two (#457). Twenty-four sessions used to
              put forty-eight pastel pills on screen, all at a tenth of their
              opacity — colour spent everywhere signals nothing. The category
              keeps its badge because it is the only one carrying meaning; the
              format moved to the last line, in words. */}
          {!isGrid && (
            <span className="whitespace-nowrap rounded-full bg-bleu/10 px-2 py-0.5 text-xs font-bold text-bleu">
              {formatLabels[talk.format]}
            </span>
          )}
          {categoryName && (
            <span
              className={`max-w-full rounded-full px-2 py-0.5 text-xs font-bold ${
                isGrid ? "break-words" : "truncate whitespace-nowrap"
              }`}
              style={{ backgroundColor: `${talk.category!.color}20`, color: talk.category!.color }}
            >
              {categoryName}
            </span>
          )}
        </div>

        {/* The title is not localized (#293) — a talk is given in one language. */}
        <p className="mt-2 text-sm font-bold leading-snug text-noir">{talk.title}</p>

        {!isGrid && talk.speakers.length > 0 && (
          <p className="mt-1 text-xs text-gris">{talk.speakers.map((s) => s.name).join(", ")}</p>
        )}

        {isSimulcast && simulcastLabel && (
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-gris-sur-creme">
            {simulcastLabel}
          </p>
        )}

        <p className="mt-auto pt-2 text-xs tabular-nums text-gris">
          {isGrid ? (
            [formatLabels[talk.format], duration].filter(Boolean).join(" · ")
          ) : (
            <>
              {formatEventTime(talk.startsAt)}
              {endsAt ? ` – ${endsAt}` : ""}
              {roomName ? ` · ${roomName}` : ""}
            </>
          )}
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
