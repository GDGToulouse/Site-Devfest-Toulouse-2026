"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { adminFetch, humanError } from "@/lib/admin-api";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import TypedConfirmDialog from "@/components/admin/TypedConfirmDialog";

interface Station {
  code: string;
  kind: "scan" | "help" | "counter";
  counter: number | null;
  name: string;
  url: string;
  /** Drawn by the backend with the badges' QR library. */
  qrSvg: string;
}

interface Stations {
  year: number;
  generation: number;
  window: { from: string | null; until: string | null };
  effective: { from: string | null; until: string | null };
  stations: Station[];
}

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const qrSource = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// One A4 page per station: the name very large, the QR code, two lines (#775).
// Rendered outside the app's tree, and alone on paper (globals.css hides the
// rest of the page while `print-stations` is on the body).
function StationSheets({ data }: { data: Stations }) {
  useEffect(() => {
    document.body.classList.add("print-stations");
    return () => document.body.classList.remove("print-stations");
  }, []);

  const { from, until } = data.effective;
  return createPortal(
    <div className="print-only station-sheets">
      <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>
      {data.stations.map((station) => {
        return (
          <section key={station.code} className="station-sheet">
            <p className="station-sheet-event">Accueil DevFest Toulouse {data.year}</p>
            <h2 className="station-sheet-name">{station.name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, nothing to optimise */}
            <img className="station-sheet-qr" src={qrSource(station.qrSvg)} alt={`QR code du poste ${station.name}`} />
            <p className="station-sheet-line">Scannez avec l&apos;appareil photo de votre téléphone.</p>
            <p className="station-sheet-small">
              {from && until
                ? `Valable du ${formatMoment(from)} au ${formatMoment(until)}. Ne le partagez pas.`
                : "Ne le partagez pas."}
            </p>
          </section>
        );
      })}
    </div>,
    document.body,
  );
}

// The station links (RG-ARR-70 to RG-ARR-76, #775): when the QR codes open
// their station, the sheets to print, and the regeneration that retires them.
export default function StationsSection({ editionId }: { editionId: number }) {
  const [data, setData] = useState<Stations | null>(null);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  function apply(next: Stations) {
    setData(next);
    // The form shows what is in force, default or set, so the admin edits from it.
    setFrom(isoToLocalInput(next.effective.from));
    setUntil(isoToLocalInput(next.effective.until));
  }

  useEffect(() => {
    adminFetch<Stations>(`/arrivals-stations/${editionId}`).then(({ data: loaded }) => {
      if (loaded) apply(loaded);
    });
  }, [editionId]);

  // The sheets are in the page once `isPrinting` is set: print, then step aside.
  useEffect(() => {
    if (!isPrinting) return;
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    const timer = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [isPrinting]);

  async function saveWindow(body: { from: string | null; until: string | null }) {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    const result = await adminFetch<Stations>(`/arrivals-stations/${editionId}/window`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setIsSaving(false);
    if (result.status === 200 && result.data) {
      apply(result.data);
      setNotice("Fenêtre enregistrée.");
    } else {
      setError(humanError(result, "La fenêtre n'a pas été enregistrée. Réessayez."));
    }
  }

  async function handleRegenerate() {
    setIsRegenerateOpen(false);
    setError(null);
    setNotice(null);
    const result = await adminFetch<Stations>(`/arrivals-stations/${editionId}/regenerate`, { method: "POST" });
    if (result.status === 200 && result.data) {
      apply(result.data);
      setNotice("Nouveaux QR codes générés. Les anciens ne marchent plus : réimprimez les pages.");
    } else {
      setError(humanError(result, "Les QR codes n'ont pas été régénérés. Réessayez."));
    }
  }

  if (!data) return null;

  const hasWindow = data.effective.from !== null && data.effective.until !== null;

  return (
    <section className="mt-8 pt-6 border-t border-gris/20">
      <h3 className="text-lg font-bold text-noir mb-2">QR codes des postes</h3>
      <p className="text-sm text-gris mb-4">
        Chaque poste a son QR code : le scanner ouvre le poste, sans compte ni mot de passe. Un QR code affiché est une
        clé que n&apos;importe qui peut photographier. Il ouvre un poste seulement (jamais le back-office, le suivi ou
        un autre poste), pendant la fenêtre ci-dessous. Le compte nominatif des bénévoles reste possible.
      </p>

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="p-3 rounded-lg bg-malachite/10 text-noir text-sm mb-4">
          {notice}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveWindow({ from: localInputToIso(from), until: localInputToIso(until) });
        }}
        className="mb-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="stations-from" className="block text-sm text-gris mb-1">
              Ouverture
            </label>
            <input
              id="stations-from"
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gris/30 text-sm"
            />
          </div>
          <div>
            <label htmlFor="stations-until" className="block text-sm text-gris mb-1">
              Fermeture
            </label>
            <input
              id="stations-until"
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gris/30 text-sm"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gris">
          {data.window.from === null && data.window.until === null
            ? "Fenêtre par défaut : de minuit la veille de l'événement (répétition) à la fin de son dernier jour, heure de Paris."
            : "Fenêtre personnalisée."}{" "}
          {hasWindow
            ? `En vigueur : du ${formatMoment(data.effective.from!)} au ${formatMoment(data.effective.until!)}.`
            : "Aucune date d'événement sur l'édition : tant que la fenêtre n'est pas fixée, les QR codes sont refusés."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSaving || !from || !until}
            className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
          >
            Enregistrer la fenêtre
          </button>
          <button
            type="button"
            disabled={isSaving || (data.window.from === null && data.window.until === null)}
            onClick={() => saveWindow({ from: null, until: null })}
            className="px-4 py-2 rounded-lg border border-gris/30 text-sm text-gris hover:bg-blanc-casse disabled:opacity-50"
          >
            Revenir à la fenêtre par défaut
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm text-noir">
          {data.stations.length} postes, génération {data.generation}.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsPrinting(true)}
            className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90"
          >
            Imprimer les pages A4
          </button>
          <button
            type="button"
            onClick={() => setIsRegenerateOpen(true)}
            className="px-4 py-2 rounded-lg border border-terre-cuite/50 text-sm text-terre-cuite hover:bg-terre-cuite/5"
          >
            Régénérer
          </button>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.stations.map((station) => (
          <li key={station.code} className="flex items-center gap-3 rounded-xl border border-gris/20 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, nothing to optimise */}
            <img
              src={qrSource(station.qrSvg)}
              alt={`QR code du poste ${station.name}`}
              className="h-20 w-20 shrink-0 bg-blanc"
            />
            <div className="min-w-0">
              <p className="font-bold text-noir">{station.name}</p>
              <a href={station.url} target="_blank" rel="noreferrer" className="text-sm text-bleu hover:underline">
                Ouvrir ce poste
              </a>
            </div>
          </li>
        ))}
      </ul>

      <TypedConfirmDialog
        isOpen={isRegenerateOpen}
        title="Régénérer les QR codes ?"
        message="Tous les QR codes imprimés et toutes les sessions qu'ils ont ouvertes cessent de marcher, sur tous les appareils. Il faudra réimprimer les pages et les remettre aux postes."
        word="REGENERER"
        confirmLabel="Régénérer"
        onConfirm={handleRegenerate}
        onCancel={() => setIsRegenerateOpen(false)}
      />

      {isPrinting && <StationSheets data={data} />}
    </section>
  );
}
