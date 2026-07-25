import type { Replay } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";
import { Link } from "@/i18n/navigation";
import SpeakerAvatars from "@/components/speakers/SpeakerAvatars";

interface ReplayCardProps {
  replay: Replay;
  locale: string;
  // The filters currently applied, so a tag can narrow the view instead of
  // resetting it: clicking "2019" on a Conference-filtered list keeps the format.
  current: { q: string; year: string; format: string; category: string };
  labels: {
    watch: string;
    filterBy: string;
    languageLabels: Record<string, string>;
    formatLabels: Record<string, string>;
  };
}

// Tags are links, not buttons: #102 filters server-side on purpose so a filtered
// view stays a shareable, indexable URL. An onClick handler would break that.
function filterHref(
  current: ReplayCardProps["current"],
  key: "year" | "format" | "category",
  value: string,
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, [key]: value })) {
    if (v) params.set(k, String(v));
  }
  return `/replays?${params.toString()}`;
}

export default function ReplayCard({ replay, locale, current, labels }: ReplayCardProps) {
  const category = replay.category ? localizedField(replay.category, "name", locale) : null;
  const languageLabel = labels.languageLabels[replay.language] ?? replay.language.toUpperCase();
  const talkHref = `/editions/${replay.year}/conferences/${replay.slug}`;

  // Tags share one muted style so the reading order stays title → speakers →
  // tags. Only the category keeps its own colour, which carries meaning.
  const tagClass =
    "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors hover:brightness-95";

  return (
    <article className="flex h-full flex-col rounded-[16px] border border-[rgba(29,29,27,0.08)] bg-blanc p-5 shadow-card transition-shadow duration-200 hover:shadow-lg">
      {/* The whole card is not a single link: the tags below are links too, and
          nesting <a> inside <a> is invalid HTML. The title carries the link. */}
      <h3 className="text-lg font-bold leading-snug text-noir">
        <Link href={talkHref} className="hover:text-bleu focus:outline-none focus:ring-2 focus:ring-malachite/50">
          {replay.title}
        </Link>
      </h3>

      {replay.speakers.length > 0 && (
        <div className="mt-3">
          <SpeakerAvatars speakers={replay.speakers} year={replay.year} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-gris">
        <Link
          href={filterHref(current, "year", String(replay.year))}
          className={`${tagClass} bg-bismarck/10 font-bold text-bismarck`}
          title={labels.filterBy.replace("{value}", String(replay.year))}
        >
          {replay.year}
        </Link>
        <Link
          href={filterHref(current, "format", replay.format)}
          className={`${tagClass} bg-blanc-casse text-gris`}
          title={labels.filterBy.replace("{value}", labels.formatLabels[replay.format] ?? replay.format)}
        >
          {labels.formatLabels[replay.format] ?? replay.format}
        </Link>
        {category && (
          <Link
            href={filterHref(current, "category", replay.category!.nameFr)}
            className={tagClass}
            style={{ backgroundColor: `${replay.category!.color}20`, color: replay.category!.color }}
            title={labels.filterBy.replace("{value}", category)}
          >
            {category}
          </Link>
        )}
        {/* Language is not a filter of its own, so it stays a plain badge. */}
        <span className={`${tagClass} bg-blanc-casse text-gris`}>{languageLabel}</span>
      </div>

      <a
        href={replay.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-fit items-center gap-2 self-start rounded-lg bg-terre-cuite px-4 py-2 text-sm font-medium text-blanc transition-colors hover:bg-terre-cuite/90"
      >
        {/* Play glyph, decorative: the link text already names the action. */}
        <span aria-hidden="true">▶</span>
        {labels.watch}
        <span className="sr-only"> — {replay.title}</span>
      </a>
    </article>
  );
}
