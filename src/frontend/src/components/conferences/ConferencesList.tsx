import { Link } from "@/i18n/navigation";

import type { EditionTalk } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";
import SpeakerAvatars from "@/components/speakers/SpeakerAvatars";

interface ConferencesListProps {
  talks: EditionTalk[];
  locale: string;
  // Pre-resolved labels: the parent owns the `conferences` translation
  // namespace, so this component stays a plain server component.
  formatLabels: Record<string, string>;
}

// Public list of the current edition's published talks (#207). Each entry links
// to its detail page; badges mirror the ones used there.
export default function ConferencesList({ talks, locale, formatLabels }: ConferencesListProps) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {talks.map((talk) => {
        // The title is not localized (#293) — a talk is given in one language.
        const title = talk.title;
        const categoryName = talk.category ? localizedField(talk.category, "name", locale) : null;

        return (
          <li key={talk.slug} className="h-full">
            {/* Cards stretch to the tallest in their row, so the speaker line
                stays pinned to the bottom whatever the title length. */}
            <Link
              href={`/conferences/${talk.slug}`}
              className="flex h-full flex-col rounded-2xl bg-blanc shadow-card p-5 transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-bleu/10 px-3 py-1 text-sm font-bold text-bleu">
                  {formatLabels[talk.format]}
                </span>
                {categoryName && (
                  <span
                    className="rounded-full px-3 py-1 text-sm font-bold"
                    style={{ backgroundColor: `${talk.category!.color}20`, color: talk.category!.color }}
                  >
                    {categoryName}
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-lg font-bold text-noir">{title}</h2>

              {talk.speakers.length > 0 && (
                <div className="mt-auto pt-3">
                  {/* The whole card is already a link, so the names stay text. */}
                  <SpeakerAvatars speakers={talk.speakers} asPlainText />
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
