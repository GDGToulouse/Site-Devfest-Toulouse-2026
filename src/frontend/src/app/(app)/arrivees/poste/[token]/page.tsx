"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ARRIVALS_SPACE } from "@/lib/account-spaces";
import { openStationSession } from "@/lib/arrivals-api";

// The landing of a station's QR code (RG-ARR-70, #775): the token in the
// address becomes the station's session, then the page moves on to the screen
// of that station. Nothing to type, nothing to choose. The token is spent here
// on purpose and never kept: the address is replaced, so it stays out of the
// browser history and of the service worker's copies.

export default function ArrivalsStationLinkPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    openStationSession(token).then(({ data, status, message }) => {
      if (data) {
        router.replace(data.path);
        return;
      }
      setRefusal(
        message ??
          (status === 0
            ? "Pas de connexion au serveur. Vérifiez le réseau, puis rechargez la page."
            : "Ce lien de poste n'est pas valable. Demandez le QR code à l'équipe DevFest."),
      );
    });
  }, [token, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-6 text-center text-2xl font-bold text-noir">{ARRIVALS_SPACE.name}</h1>
        {refusal ? (
          <p role="alert" className="text-center text-noir">
            {refusal}
          </p>
        ) : (
          <p className="text-center text-gris">Ouverture du poste…</p>
        )}
      </div>
    </div>
  );
}
