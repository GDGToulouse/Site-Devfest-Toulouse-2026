"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getArrivalsCurrent } from "@/lib/arrivals-api";
import ConnectionIndicator from "@/components/arrivals/ConnectionIndicator";
import CounterBoard from "@/components/arrivals/CounterBoard";
import HelpStation from "@/components/arrivals/HelpStation";
import StationPicker from "@/components/arrivals/StationPicker";
import ScanStation from "@/components/arrivals/ScanStation";
import { isStationInLayout, stationLabel, stationPath, type Station } from "@/lib/arrivals-station";
import { useArrivalsStream } from "@/lib/use-arrivals-stream";

// Discreet, but a finger-sized target (44 px).
const FOOTER_LINK = "inline-flex min-h-11 items-center px-3 underline decoration-gris/40 hover:text-noir";

const STATION_ENDED = "Ce poste n'est plus ouvert. Demandez le QR code à jour à l'équipe DevFest.";

// The event-day zone once the volunteer is let in (#641): the station the
// address names, the link to the live state, and what the stations share. Each
// station has its screen: Scan (#642), Guichet (#643), Aide (#713). A station
// opened by its QR code (#775) is `isLocked`: no way to another station, to the
// tracking screen or to a sign-out, since there is no account to sign out of.
export default function ArrivalsWorkspace({
  edition,
  station,
  isLocked,
  canStepBack,
  canTrack,
  onSignOut,
  onLockedOut,
}: {
  edition: { id: number; year: number };
  /** From the address; null on /arrivees, where the station is chosen. */
  station: Station | null;
  isLocked: boolean;
  canStepBack: boolean;
  canTrack: boolean;
  onSignOut: () => void;
  /** A locked station's session was refused: the zone shows why. */
  onLockedOut: (message: string) => void;
}) {
  const router = useRouter();
  const { live, status, applyMoved } = useArrivalsStream(edition.id);
  const [pendingScans, setPendingScans] = useState(0);
  // A counter's three columns take the whole screen: the cards are read from a step away (#776).
  const isWide = station?.kind === "counter";
  const isMissingStation = Boolean(station && live && !isStationInLayout(station, live.layout));

  // A station's session ends with its window or a regeneration (RG-ARR-75): the
  // stream then just fails, which reads as a network cut. Ask the backend which
  // it is, and say so instead of leaving a screen that retries for nothing.
  useEffect(() => {
    if (!isLocked || status !== "disconnected") return;
    const timer = setInterval(() => {
      getArrivalsCurrent().then(({ status: httpStatus, error, message }) => {
        if (httpStatus === 403 && error?.startsWith("station_")) onLockedOut(message ?? STATION_ENDED);
      });
    }, 5_000);
    return () => clearInterval(timer);
  }, [isLocked, status, onLockedOut]);

  return (
    // Never on paper: the help desk's label prints alone (BadgeLabel.tsx).
    <div className="no-print min-h-dvh bg-blanc-casse pb-10">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gris/20 bg-blanc px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-gris">Accueil DevFest {edition.year}</p>
          <h1 className="truncate font-bold text-noir">{station ? stationLabel(station) : "Poste à choisir"}</h1>
        </div>
        <ConnectionIndicator status={status} pendingScans={station?.kind === "scan" ? pendingScans : 0} />
      </header>

      <main className={`mx-auto px-4 pt-6 ${isWide ? "lg:px-8" : "max-w-2xl"}`}>
        {status === "disconnected" && (
          <div role="alert" className="mb-4 rounded-2xl bg-rouge/10 p-4 text-sm text-noir">
            Pas de connexion au serveur : ce qui s&apos;affiche peut être périmé. L&apos;écran se remettra à jour seul
            dès le retour du réseau.
          </div>
        )}

        {station?.kind === "scan" ? (
          // Without the live state too: the degraded mode is for when it is gone.
          <ScanStation editionId={edition.id} live={live} status={status} onPendingChange={setPendingScans} />
        ) : !live ? (
          status !== "disconnected" && <p className="text-center text-gris">Chargement…</p>
        ) : station === null ? (
          <div className="rounded-3xl bg-blanc p-6 shadow-card">
            <StationPicker layout={live.layout} onPick={(next) => router.push(stationPath(next))} />
          </div>
        ) : isMissingStation ? (
          <p role="alert" className="rounded-2xl bg-rouge/10 p-4 text-center text-noir">
            Ce poste n&apos;existe pas pour cette édition. Choisissez un poste dans la liste.
          </p>
        ) : station.kind === "help" ? (
          <HelpStation edition={edition} live={live} canCancelScans={canStepBack} />
        ) : (
          <CounterBoard
            editionId={edition.id}
            counter={station.counter}
            live={live}
            canStepBack={canStepBack}
            onMoved={applyMoved}
          />
        )}

        {/* Out of the foreground: a station has its own address, so these are for the rare move. */}
        {!isLocked && (
          <nav aria-label="Autres écrans" className="mt-10 flex flex-wrap justify-center gap-x-2 text-sm text-gris">
            {station && (
              <Link href="/arrivees" className={FOOTER_LINK}>
                Changer de poste
              </Link>
            )}
            {canTrack && (
              <Link href="/arrivees/suivi" className={FOOTER_LINK}>
                Écran de suivi
              </Link>
            )}
            <button type="button" onClick={onSignOut} className={FOOTER_LINK}>
              Me déconnecter
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}
