"use client";

import { useEffect, useState } from "react";

import { cancelScan } from "@/lib/arrivals-api";

// Undo a scan (#797): a wrong name picked in the search, a ticket read for the
// person behind. The entrance has a minute on its own scan; the server holds
// the same rule, this only hides the button once it no longer works.

/** The server's window (lib/arrivals-scan.ts, CANCEL_SCAN_WINDOW_MS). */
export const CANCEL_SCAN_WINDOW_MS = 60_000;

const FAILURES: Record<string, string> = {
  too_late: "Plus d'une minute depuis le scan : demandez à un admin de l'annuler.",
  delivered: "Le badge a déjà été remis : récupérez-le, puis demandez à un admin.",
  not_yours: "Seul le poste qui a scanné ce billet, ou un admin, peut annuler le scan.",
  not_scanned: "Ce billet n'est plus scanné : rien à annuler.",
};

export default function CancelScan({
  editionId,
  attendee,
  scannedAt,
  isAdmin = false,
  onCancelled,
}: {
  editionId: number;
  attendee: { id: number; firstName: string; lastName: string };
  /** When this screen got the scan's answer: the button goes after the window. */
  scannedAt: number | null;
  /** An admin cancels at any time, any scan. */
  isAdmin?: boolean;
  onCancelled: (message: string) => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (isAdmin || scannedAt === null) return;
    const left = scannedAt + CANCEL_SCAN_WINDOW_MS - Date.now();
    if (left <= 0) {
      setIsExpired(true);
      return;
    }
    const timer = setTimeout(() => setIsExpired(true), left);
    return () => clearTimeout(timer);
  }, [isAdmin, scannedAt]);

  if (isExpired && !error) return null;
  const name = `${attendee.firstName} ${attendee.lastName}`;

  async function confirm() {
    setIsBusy(true);
    const { data, status, error: code } = await cancelScan(editionId, attendee.id);
    setIsBusy(false);
    setIsConfirming(false);
    if (data) {
      onCancelled(`Scan annulé : ${name} n'est plus compté comme arrivé, son badge reste au présentoir.`);
      return;
    }
    setError(
      (code && FAILURES[code]) ??
        (status === 0 || status >= 500
          ? "Le serveur ne répond pas : vérifiez la connexion, puis réessayez."
          : "L'annulation n'a pas abouti. Réessayez."),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-2xl bg-rouge/10 p-3 text-sm text-noir">
          {error}
        </p>
      )}
      {!isExpired &&
        (isConfirming ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={isBusy}
              className="flex-1 rounded-2xl bg-rouge px-4 py-3 font-bold text-blanc disabled:opacity-50"
            >
              Confirmer : annuler le scan de {name}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isBusy}
              className="rounded-2xl border border-gris/30 px-4 py-3 text-noir"
            >
              Garder
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsConfirming(true);
            }}
            className="rounded-2xl border border-rouge px-4 py-3 font-medium text-rouge"
          >
            Annuler ce scan
          </button>
        ))}
    </div>
  );
}
