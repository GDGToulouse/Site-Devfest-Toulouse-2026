"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getArrivalsCurrent, type ArrivalsCurrent } from "@/lib/arrivals-api";
import TrackingScreen from "@/components/arrivals/TrackingScreen";

// The team's tracking screen (RG-ARR-26, #644): ADMIN and EDITOR only, the
// arrivals permission alone does not open it. The backend's guard decides;
// this page only spares a volunteer a screen that would never load.

export default function ArrivalsTrackingPage() {
  const router = useRouter();
  const [current, setCurrent] = useState<ArrivalsCurrent | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getArrivalsCurrent().then(({ data, status }) => {
      if (status === 401) {
        router.replace("/arrivees/connexion?next=/arrivees/suivi");
        return;
      }
      if (!data) setLoadError(true);
      else setCurrent(data);
    });
  }, [router]);

  if (current?.edition && current.canTrack) return <TrackingScreen edition={current.edition} />;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 text-center shadow-card">
        <h1 className="mb-6 text-2xl font-bold text-noir">Suivi des arrivées</h1>
        {loadError ? (
          <p role="alert" className="text-terre-cuite">
            Le serveur n&apos;a pas répondu. Vérifiez la connexion, puis rechargez la page.
          </p>
        ) : !current ? (
          <p className="text-gris">Chargement…</p>
        ) : !current.edition ? (
          <p className="text-noir">Aucune édition n&apos;est en cours.</p>
        ) : (
          <p className="text-noir">Cet écran est réservé à l&apos;équipe DevFest (administrateurs et éditeurs).</p>
        )}
        <Link href="/arrivees" className="mt-6 block text-sm font-medium text-gris hover:text-noir">
          Retour à l&apos;accueil des participants
        </Link>
      </div>
    </div>
  );
}
