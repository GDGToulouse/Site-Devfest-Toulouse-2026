import type { EditionTalk } from "@/lib/types";
import { localizedField } from "@/lib/i18n-helpers";

interface EditionTalksListProps {
  talks: EditionTalk[];
  locale: string;
  replayLabel: string;
}

// Read-only session list for a past edition (issue #63): title, speakers,
// category badge and a replay link when a recording is available.
export default function EditionTalksList({ talks, locale, replayLabel }: EditionTalksListProps) {
  return (
    <ul className="space-y-4">
      {talks.map((talk) => {
        const title = localizedField(talk, "title", locale);
        const speakerNames = talk.speakers.map((s) => s.name).join(", ");
        return (
          <li
            key={talk.slug}
            className="flex flex-col gap-2 rounded-2xl bg-blanc shadow-card p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {talk.category && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: talk.category.color }}
                    aria-hidden="true"
                  />
                )}
                <h3 className="font-bold text-noir">{title}</h3>
              </div>
              {speakerNames && <p className="mt-1 text-sm text-gris">{speakerNames}</p>}
            </div>
            {talk.videoUrl && (
              <a
                href={talk.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2 rounded-[12px] bg-bismarck text-blanc text-sm font-bold hover:bg-bismarck/90 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {replayLabel}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
