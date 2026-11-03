"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/admin-api";
import { ARRIVALS_SPACE } from "@/lib/account-spaces";
import { getArrivalsCurrent, type ArrivalsCurrent } from "@/lib/arrivals-api";
import {
  isSameStation,
  recallArrivalsEdition,
  rememberArrivalsEdition,
  stationPath,
  type Station,
} from "@/lib/arrivals-station";
import ArrivalsWorkspace from "@/components/arrivals/ArrivalsWorkspace";

// The event-day zone (RG-ARR-21, RG-ARR-22, #640): open to the holders of the
// current edition's arrivals permission, to admins, and to a station opened by
// its QR code (#775). One page per station, so a link names its station; the
// page without one (`station` null) is the choice of station.

export default function ArrivalsZone({ station }: { station: Station | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState<ArrivalsCurrent | null>(null);
  const [loadError, setLoadError] = useState(false);
  // A station link or session the backend refused, with its reason.
  const [refusal, setRefusal] = useState<string | null>(null);
  const here = station ? stationPath(station) : "/arrivees";

  useEffect(() => {
    getArrivalsCurrent().then(({ data, status, error, message }) => {
      if (status === 401) {
        router.replace(`/arrivees/connexion?next=${encodeURIComponent(here)}`);
        return;
      }
      if (status === 403 && error?.startsWith("station_")) {
        setRefusal(message ?? "Ce poste n'est plus ouvert.");
        return;
      }
      if (!data) {
        // Backend out of reach (0) or down behind the relay (5xx): reopen the
        // edition this device was last let into, cut off but usable.
        const remembered = status === 0 || status >= 500 ? recallArrivalsEdition() : null;
        if (remembered) {
          setCurrent({ edition: remembered, hasAccess: true, canStepBack: false, canTrack: false, station: null });
        } else setLoadError(true);
        return;
      }
      // A station never leaves its own screen (RG-ARR-72).
      if (data.station && !(station && isSameStation(station, data.station))) {
        router.replace(stationPath(data.station));
        return;
      }
      rememberArrivalsEdition(data.hasAccess ? data.edition : null);
      setCurrent(data);
    });
  }, [router, here, station]);

  async function handleSignOut() {
    rememberArrivalsEdition(null);
    await signOut();
    router.replace("/arrivees/connexion");
  }

  if (!refusal && current?.edition && current.hasAccess) {
    return (
      <ArrivalsWorkspace
        edition={current.edition}
        station={station}
        isLocked={current.station !== null}
        canStepBack={current.canStepBack}
        canTrack={current.canTrack}
        onSignOut={handleSignOut}
        onLockedOut={setRefusal}
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-6 text-center text-2xl font-bold text-noir">{ARRIVALS_SPACE.name}</h1>

        {refusal ? (
          <p role="alert" className="text-center text-noir">
            {refusal}
          </p>
        ) : loadError ? (
          <p role="alert" className="text-center text-terre-cuite">
            Le serveur n&apos;a pas répondu. Vérifiez la connexion, puis rechargez la page.
          </p>
        ) : !current ? (
          <p className="text-center text-gris">Chargement…</p>
        ) : (
          <>
            <p className="text-center text-noir">
              {current.edition
                ? `Ce compte n'a pas accès à l'accueil du DevFest Toulouse ${current.edition.year}.`
                : "Aucune édition n'est en cours."}
            </p>
            {current.canTrack && current.edition ? (
              <Link
                href="/arrivees/suivi"
                className="mt-4 block rounded-2xl bg-bleu px-4 py-3 text-center font-medium text-blanc hover:bg-bleu/90"
              >
                Ouvrir l&apos;écran de suivi
              </Link>
            ) : (
              <p className="mt-3 text-center text-sm text-gris">
                Si vous êtes bénévole, scannez le QR code de votre poste ou demandez-le à l&apos;équipe DevFest.
              </p>
            )}
          </>
        )}

        {current && !refusal && (
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 w-full text-sm font-medium text-gris hover:text-noir"
          >
            Me déconnecter
          </button>
        )}
      </div>
    </div>
  );
}
