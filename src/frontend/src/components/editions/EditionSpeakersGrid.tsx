import Image from "next/image";

import type { EditionSpeaker } from "@/lib/types";

interface EditionSpeakersGridProps {
  speakers: EditionSpeaker[];
}

// Read-only speaker grid for a past edition (issue #63). No link to a detail
// page: speaker detail pages are scoped to the featured edition, and historical
// speakers carry no detail beyond name/company here.
export default function EditionSpeakersGrid({ speakers }: EditionSpeakersGridProps) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {speakers.map((s) => (
        <li key={s.slug} className="flex flex-col items-center text-center">
          {s.photoUrl ? (
            <div className="relative h-24 w-24 rounded-full overflow-hidden bg-blanc-casse">
              <Image src={s.photoUrl} alt={s.name} fill sizes="96px" className="object-cover" />
            </div>
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blanc-casse text-2xl font-bold text-gris">
              {s.name.charAt(0)}
            </span>
          )}
          <p className="mt-3 font-bold text-noir">{s.name}</p>
          {s.company && <p className="text-sm text-gris">{s.company}</p>}
        </li>
      ))}
    </ul>
  );
}
