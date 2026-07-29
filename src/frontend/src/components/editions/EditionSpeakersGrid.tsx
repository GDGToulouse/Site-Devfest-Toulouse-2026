import type { EditionSpeaker } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";

interface EditionSpeakersGridProps {
  speakers: EditionSpeaker[];
}

// Speaker grid for a past edition (#63). The grid stays edition-scoped — it
// answers "who spoke that year" — but each link now goes to the person's single
// page (#352) rather than a year-scoped copy of it.
export default function EditionSpeakersGrid({ speakers }: EditionSpeakersGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
      {speakers.map((s) => (
        <li key={s.slug} className="flex flex-col items-center text-center">
          <Link
            href={`/speakers/${s.slug}`}
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
