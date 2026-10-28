"use client";

import { useEffect, useState } from "react";

import ConnectionIndicator from "@/components/arrivals/ConnectionIndicator";
import StationPicker from "@/components/arrivals/StationPicker";
import ScanStation from "@/components/arrivals/ScanStation";
import { counterLoads } from "@/lib/arrivals-live";
import { readStation, saveStation, stationLabel, type Station } from "@/lib/arrivals-station";
import { useArrivalsStream } from "@/lib/use-arrivals-stream";

// The event-day zone once the volunteer is let in (#641): the station this
// device works as, the link to the live state, and what the stations share.
// Scan has its screen (#642); Guichet and Aide come with #643 and #713.
export default function ArrivalsWorkspace({
  edition,
  onSignOut,
}: {
  edition: { id: number; year: number };
  onSignOut: () => void;
}) {
  // undefined until the device's memory is read: never offer the picker to a
  // counter laptop that already knows its counter.
  const [station, setStation] = useState<Station | null | undefined>(undefined);
  const { live, status } = useArrivalsStream(edition.id);

  useEffect(() => {
    setStation(readStation());
  }, []);

  function pick(next: Station | null) {
    saveStation(next);
    setStation(next);
  }

  return (
    <div className="min-h-dvh bg-blanc-casse pb-10">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gris/20 bg-blanc px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-gris">Accueil DevFest {edition.year}</p>
          <p className="truncate font-bold text-noir">{station ? stationLabel(station) : "Poste à choisir"}</p>
        </div>
        <ConnectionIndicator status={status} />
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6">
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
        ) : (
          <>
            <section className="rounded-3xl bg-blanc p-6 shadow-card" aria-labelledby="counters-title">
              <h2 id="counters-title" className="mb-4 text-lg font-bold text-noir">
                Charge des guichets
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gris/20 text-gris">
                      <th className="py-2 text-left font-medium">Guichet</th>
                      <th className="py-2 text-right font-medium">À chercher</th>
                      <th className="py-2 text-right font-medium">Prêts</th>
                      <th className="py-2 text-right font-medium">Distribués</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterLoads(live).map((load) => (
                      <tr key={load.counter} className="border-b border-gris/10 text-noir">
                        <td className="py-2">Guichet {load.counter}</td>
                        <td className="py-2 text-right">{load.toFetch}</td>
                        <td className="py-2 text-right">{load.ready}</td>
                        <td className="py-2 text-right">{load.delivered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-gris">
                L&apos;écran de ce poste arrive bientôt. Ces chiffres se mettent à jour seuls.
              </p>
            </section>
          </>
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
