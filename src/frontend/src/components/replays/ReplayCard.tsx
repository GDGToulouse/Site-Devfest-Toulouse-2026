import type { Replay } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";

interface ReplayCardProps {
  replay: Replay;
  locale: string;
  labels: { watch: string; formatLabels: Record<string, string> };
}

export default function ReplayCard({ replay, locale, labels }: ReplayCardProps) {
  const category = replay.category ? localizedField(replay.category, "name", locale) : null;
  const speakers = replay.speakers.map((s) => s.name).join(", ");

  return (
    <article className="flex h-full flex-col rounded-[16px] border border-[rgba(29,29,27,0.08)] bg-blanc p-5 shadow-card transition-shadow duration-200 hover:shadow-lg">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {/* The edition year is the point of this page: it is what tells apart
            two talks the visitor half-remembers. */}
        <span className="rounded-full bg-bismarck px-2.5 py-1 font-bold text-blanc">{replay.year}</span>
        <span className="rounded-full bg-blanc-casse px-2.5 py-1 font-medium text-gris">
          {labels.formatLabels[replay.format] ?? replay.format}
        </span>
        {category && (
          <span
            className="rounded-full px-2.5 py-1 font-medium text-blanc"
            style={{ backgroundColor: replay.category!.color }}
          >
            {category}
          </span>
        )}
      </div>

      <h3 className="text-lg font-bold leading-snug text-noir">{replay.title}</h3>
      {speakers && <p className="mt-2 text-sm text-gris">{speakers}</p>}

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
