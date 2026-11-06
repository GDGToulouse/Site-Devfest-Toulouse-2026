"use client";

import type { BadgeLayout } from "@/lib/arrivals-live";
import type { Station } from "@/lib/arrivals-station";

const CHOICE_CLASS =
  "rounded-2xl border border-gris/30 bg-blanc px-4 py-4 text-left text-noir hover:border-bleu focus-visible:border-bleu";

// The first question of the zone (RG-ARR-25): which station this device is.
// A counter is one station: the volunteers behind it serve all its présentoirs.
export default function StationPicker({
  layout,
  onPick,
}: {
  layout: BadgeLayout;
  onPick: (station: Station) => void;
}) {
  const counters = Array.from({ length: layout.counters }, (_, i) => i + 1);

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-noir">Votre poste</h2>
      <p className="mb-4 text-sm text-gris">Vous pourrez en changer à tout moment.</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onPick({ kind: "scan" })} className={`${CHOICE_CLASS} col-span-2`}>
          <span className="block font-bold">Scan</span>
          <span className="block text-sm text-gris">Lire les billets à l&apos;entrée</span>
        </button>
        {counters.map((n) => (
          <button key={n} type="button" onClick={() => onPick({ kind: "counter", counter: n })} className={CHOICE_CLASS}>
            <span className="block font-bold">Guichet {n}</span>
            <span className="block text-sm text-gris">Numéros {n}xxx</span>
          </button>
        ))}
        <button type="button" onClick={() => onPick({ kind: "help" })} className={`${CHOICE_CLASS} col-span-2`}>
          <span className="block font-bold">Cas particuliers</span>
          <span className="block text-sm text-gris">Billets sans badge, étiquettes, badges remboursés</span>
        </button>
      </div>
    </div>
  );
}
