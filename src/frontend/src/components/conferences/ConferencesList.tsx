import { Link } from "@/i18n/navigation";

import type { EditionTalk } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";

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
    <ul className="space-y-4">
      {talks.map((talk) => {
        const title = localizedField(talk, "title", locale);
        const categoryName = talk.category ? localizedField(talk.category, "name", locale) : null;
        const speakerNames = talk.speakers.map((s) => s.name).join(", ");

        return (
          <li key={talk.slug}>
            <Link
              href={`/conferences/${talk.slug}`}
              className="block rounded-2xl bg-blanc shadow-card p-5 transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
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

              <h2 className="mt-3 text-xl font-bold text-noir">{title}</h2>

              {speakerNames && <p className="mt-1 text-sm text-gris">{speakerNames}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
