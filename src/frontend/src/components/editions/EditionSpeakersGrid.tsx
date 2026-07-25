import type { EditionSpeaker } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";

interface EditionSpeakersGridProps {
  speakers: EditionSpeaker[];
  // The edition being displayed: speaker pages are year-scoped (#103), since
  // `/speakers/[slug]` only serves the featured edition.
  year: number;
}

// Speaker grid for a past edition (#63), now linking to each detail page (#103).
export default function EditionSpeakersGrid({ speakers, year }: EditionSpeakersGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
      {speakers.map((s) => (
        <li key={s.slug} className="flex flex-col items-center text-center">
          <Link
            href={`/editions/${year}/speakers/${s.slug}`}
            className="group flex flex-col items-center"
          >
            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-blanc-casse">
              <SpeakerPhoto photoUrl={s.photoUrl} name={s.name} size={96} />
            </div>
            <p className="mt-3 font-bold text-noir group-hover:text-bleu">{s.name}</p>
            {s.company && <p className="text-sm text-gris">{s.company}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
