"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/admin-api";
import { ARRIVALS_SPACE } from "@/lib/account-spaces";
import { getArrivalsCurrent, type ArrivalsCurrent } from "@/lib/arrivals-api";

// The event-day zone (RG-ARR-21, RG-ARR-22, #640): open to the holders of the
// current edition's arrivals permission, and to admins. The stations (Scan,
// Guichet, Aide) land here with #641 to #643; this page only lets them in.

export default function ArrivalsZonePage() {
  const router = useRouter();
  const [current, setCurrent] = useState<ArrivalsCurrent | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getArrivalsCurrent().then(({ data, status }) => {
      if (status === 401) {
        router.replace("/arrivees/connexion?next=/arrivees");
        return;
      }
      if (!data) {
        setLoadError(true);
        return;
      }
      setCurrent(data);
    });
  }, [router]);

  async function handleSignOut() {
    await signOut();
    router.replace("/arrivees/connexion");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-6 text-center text-2xl font-bold text-noir">{ARRIVALS_SPACE.name}</h1>

        {loadError ? (
          <p role="alert" className="text-center text-terre-cuite">
            Le serveur n&apos;a pas répondu. Vérifiez la connexion, puis rechargez la page.
          </p>
        ) : !current ? (
          <p className="text-center text-gris">Chargement…</p>
        ) : current.edition && current.hasAccess ? (
          <>
            <p className="text-center text-noir">
              Vous avez accès à l&apos;accueil du <strong>DevFest Toulouse {current.edition.year}</strong>.
            </p>
            <p className="mt-3 text-center text-sm text-gris">
              Les écrans du jour J (scan, guichets, aide) s&apos;ouvriront ici. Gardez cette adresse : /arrivees.
            </p>
          </>
        ) : (
          <>
            <p className="text-center text-noir">
              {current.edition
                ? `Ce compte n'a pas accès à l'accueil du DevFest Toulouse ${current.edition.year}.`
                : "Aucune édition n'est en cours."}
            </p>
            <p className="mt-3 text-center text-sm text-gris">
              Si vous êtes bénévole, demandez une invitation à l&apos;équipe DevFest.
            </p>
          </>
        )}

        {current && (
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
