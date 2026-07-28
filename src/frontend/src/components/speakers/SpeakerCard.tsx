import { Link } from "@/i18n/navigation";
import type { SpeakerPublic } from "@/lib/types";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";

export default function SpeakerCard({ speaker }: { speaker: SpeakerPublic }) {
  return (
    <Link
      href={`/speakers/${speaker.slug}`}
      className="group flex flex-col items-center gap-3 text-center"
    >
      <div className="relative h-32 w-32 overflow-hidden rounded-full bg-blanc-casse">
        {/* SpeakerPhoto, not a bare next/image: this card serves /hall-of-fame
            since #352, where imported profiles carry third-party photo hosts
            that would 500 the whole page through the optimizer. */}
        <SpeakerPhoto photoUrl={speaker.photoUrl} name={speaker.name} size={128} />
      </div>
      <div>
        <p className="font-bold text-noir group-hover:text-bleu">{speaker.name}</p>
        {speaker.company && <p className="text-sm text-gris">{speaker.company}</p>}
      </div>
    </Link>
  );
}
