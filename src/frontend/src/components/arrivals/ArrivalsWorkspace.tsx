"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ConnectionIndicator from "@/components/arrivals/ConnectionIndicator";
import CounterBoard from "@/components/arrivals/CounterBoard";
import HelpStation from "@/components/arrivals/HelpStation";
import StationPicker from "@/components/arrivals/StationPicker";
import ScanStation from "@/components/arrivals/ScanStation";
import { readStation, saveStation, stationLabel, type Station } from "@/lib/arrivals-station";
import { useArrivalsStream } from "@/lib/use-arrivals-stream";

// The event-day zone once the volunteer is let in (#641): the station this
// device works as, the link to the live state, and what the stations share.
// Each station has its screen: Scan (#642), Guichet (#643), Aide (#713).
export default function ArrivalsWorkspace({
  edition,
  canStepBack,
  canTrack,
  onSignOut,
}: {
  edition: { id: number; year: number };
  canStepBack: boolean;
  canTrack: boolean;
  onSignOut: () => void;
}) {
  // undefined until the device's memory is read: never offer the picker to a
  // counter laptop that already knows its counter.
  const [station, setStation] = useState<Station | null | undefined>(undefined);
  const { live, status, applyMoved } = useArrivalsStream(edition.id);
  // A counter's three columns want the laptop's width.
  const isWide = station?.kind === "counter";

  useEffect(() => {
    setStation(readStation());
  }, []);

  function pick(next: Station | null) {
    saveStation(next);
    setStation(next);
  }

  return (
    // Never on paper: the help desk's label prints alone (BadgeLabel.tsx).
    <div className="no-print min-h-dvh bg-blanc-casse pb-10">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gris/20 bg-blanc px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-gris">Accueil DevFest {edition.year}</p>
          <p className="truncate font-bold text-noir">{station ? stationLabel(station) : "Poste à choisir"}</p>
        </div>
        <ConnectionIndicator status={status} />
      </header>

      <main className={`mx-auto px-4 pt-6 ${isWide ? "max-w-6xl" : "max-w-2xl"}`}>
        {status === "disconnected" && (
          <div role="alert" className="mb-4 rounded-2xl bg-rouge/10 p-4 text-sm text-noir">
            Pas de connexion au serveur : ce qui s&apos;affiche peut être périmé. L&apos;écran se remettra à jour seul
            dès le retour du réseau.
          </div>
        )}

        {station?.kind === "scan" ? (
          // Without the live state too: the degraded mode is for when it is gone.
          <ScanStation editionId={edition.id} live={live} status={status} />
        ) : !live || station === undefined ? (
          status !== "disconnected" && <p className="text-center text-gris">Chargement…</p>
        ) : station === null ? (
          <div className="rounded-3xl bg-blanc p-6 shadow-card">
            <StationPicker layout={live.layout} onPick={pick} />
          </div>
        ) : station.kind === "help" ? (
          <HelpStation edition={edition} live={live} />
        ) : (
          <CounterBoard
            editionId={edition.id}
            counter={station.counter}
            bin={station.bin}
            live={live}
            canStepBack={canStepBack}
            onMoved={applyMoved}
          />
        )}

        {station && (
          <button
            type="button"
            onClick={() => pick(null)}
            className="mt-6 w-full rounded-2xl border border-gris/30 bg-blanc px-4 py-3 text-sm font-medium text-noir hover:border-bleu"
          >
            Changer de poste
          </button>
        )}

        {canTrack && (
          <Link
            href="/arrivees/suivi"
            className="mt-6 block w-full rounded-2xl border border-gris/30 bg-blanc px-4 py-3 text-center text-sm font-medium text-noir hover:border-bleu"
          >
            Écran de suivi
          </Link>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 w-full text-sm font-medium text-gris hover:text-noir"
        >
          Me déconnecter
        </button>
      </main>
    </div>
  );
}
