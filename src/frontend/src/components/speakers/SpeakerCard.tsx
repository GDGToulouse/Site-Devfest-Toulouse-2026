import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { SpeakerPublic } from "@/lib/types";

export default function SpeakerCard({ speaker }: { speaker: SpeakerPublic }) {
  return (
    <Link
      href={`/speakers/${speaker.slug}`}
      className="group flex flex-col items-center gap-3 text-center"
    >
      <div className="relative h-32 w-32 overflow-hidden rounded-full bg-blanc-casse">
        {speaker.photoUrl ? (
          <Image src={speaker.photoUrl} alt={speaker.name} fill className="object-cover" sizes="128px" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-4xl font-bold text-gris">
            {speaker.name.charAt(0)}
          </span>
        )}
      </div>
      <div>
        <p className="font-bold text-noir group-hover:text-bleu">{speaker.name}</p>
        {speaker.company && <p className="text-sm text-gris">{speaker.company}</p>}
      </div>
    </Link>
  );
}
