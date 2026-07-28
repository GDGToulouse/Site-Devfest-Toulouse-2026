import { Link } from "@/i18n/navigation";
import type { HallOfFameEntry } from "@/lib/types";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";

// The hall of fame card (#352). Close to SpeakerCard, but carries the years the
// person took part in — which is the whole point of the archive view, and what
// makes a five-time speaker read as one person instead of five rows.
export default function HallOfFameCard({ person }: { person: HallOfFameEntry }) {
  return (
    <Link
      href={`/speakers/${person.slug}`}
      className="group flex flex-col items-center gap-2 text-center"
    >
      <div className="relative h-24 w-24 overflow-hidden rounded-full bg-blanc-casse">
        {/* Imported profiles host their photos anywhere — SpeakerPhoto keeps
            those off the optimizer, which would 500 the page. */}
        <SpeakerPhoto photoUrl={person.photoUrl} name={person.name} size={96} />
      </div>

      <p className="font-bold text-noir group-hover:text-bleu">{person.name}</p>
      {person.company && <p className="text-sm text-gris">{person.company}</p>}

      <p className="text-xs text-gris">{person.years.join(" · ")}</p>
    </Link>
  );
}
