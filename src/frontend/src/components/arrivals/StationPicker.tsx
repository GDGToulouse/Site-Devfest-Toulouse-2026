"use client";

import { useState } from "react";

import type { BadgeLayout } from "@/lib/arrivals-live";
import type { Station } from "@/lib/arrivals-station";

const CHOICE_CLASS =
  "rounded-2xl border border-gris/30 bg-blanc px-4 py-4 text-left text-noir hover:border-bleu focus-visible:border-bleu";

// The first question of the zone (RG-ARR-25): which station this device is.
// A counter may narrow to one of its bins, for the volunteer whose phone only
// follows their own (RG-ARR-42).
export default function StationPicker({
  layout,
  onPick,
}: {
  layout: BadgeLayout;
  onPick: (station: Station) => void;
}) {
  const [counter, setCounter] = useState<number | null>(null);
  const counters = Array.from({ length: layout.counters }, (_, i) => i + 1);
  const bins = Array.from({ length: layout.binsPerCounter }, (_, i) => i + 1);

  if (counter !== null) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-bold text-noir">Guichet {counter}</h2>
        <p className="mb-4 text-sm text-gris">Tout le guichet, ou seulement votre bac ?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onPick({ kind: "counter", counter, bin: null })}
            className={`${CHOICE_CLASS} col-span-2 font-bold`}
          >
            Tout le guichet
          </button>
          {bins.map((bin) => (
            <button
              key={bin}
              type="button"
              onClick={() => onPick({ kind: "counter", counter, bin })}
              className={CHOICE_CLASS}
            >
              Bac {bin}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCounter(null)}
          className="mt-4 text-sm font-medium text-gris hover:text-noir"
        >
          ← Autre poste
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-noir">Votre poste</h2>
      <p className="mb-4 text-sm text-gris">Cet appareil s&apos;en souviendra. Vous pourrez en changer à tout moment.</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onPick({ kind: "scan" })} className={`${CHOICE_CLASS} col-span-2`}>
          <span className="block font-bold">Scan</span>
          <span className="block text-sm text-gris">Lire les billets à l&apos;entrée</span>
        </button>
        {counters.map((n) => (
          <button key={n} type="button" onClick={() => setCounter(n)} className={CHOICE_CLASS}>
            <span className="block font-bold">Guichet {n}</span>
            <span className="block text-sm text-gris">Numéros {n}xxx</span>
          </button>
        ))}
        <button type="button" onClick={() => onPick({ kind: "help" })} className={`${CHOICE_CLASS} col-span-2`}>
          <span className="block font-bold">Aide</span>
          <span className="block text-sm text-gris">Billets sans numéro, cas particuliers</span>
        </button>
      </div>
    </div>
  );
}
