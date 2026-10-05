"use client";

import { useState } from "react";
import Link from "next/link";

import type { SessionizeImportReport as ImportReport } from "@/lib/admin-api";
import { formatEventTime } from "@/lib/datetime";
import SessionizeRoomPairing from "./SessionizeRoomPairing";

interface ImportTabProps {
  editionId: number;
}

type Source = "url" | "json";

function statusLabel(status: string): string {
  return status === "PUBLISHED" ? "publié" : "brouillon";
}

export default function ImportTab({ editionId }: ImportTabProps) {
  const [source, setSource] = useState<Source>("url");
  const [url, setUrl] = useState("");
  const [json, setJson] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importCount, setImportCount] = useState(0);

  async function handleImport() {
    setIsImporting(true);
    setReport(null);
    setError(null);

    const payload =
      source === "url"
        ? { editionId, url: url.trim() }
        : { editionId, json: json.trim() };

    try {
      const res = await fetch(`/api/admin/import/sessionize`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.detail || body?.error || `Erreur ${res.status}`);
      } else {
        setReport(body as ImportReport);
        setImportCount((count) => count + 1);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    }
    setIsImporting(false);
  }

  const canImport =
    !isImporting && (source === "url" ? url.trim().length > 0 : json.trim().length > 0);

  const inputClass =
    "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-noir">Import Sessionize</h2>
        <p className="text-sm text-gris mt-1">
          Importez les speakers et sessions depuis un export Sessionize «&nbsp;All
          data&nbsp;» (JSON). L&apos;import est idempotent&nbsp;: relancer met à jour
          les fiches existantes (rapprochées par leur slug) sans créer de doublons.
          Les fiches importées sont créées en <strong>brouillon</strong>. Créneaux et
          salles suivent Sessionize, même pour une session déplacée à la main.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSource("url")}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            source === "url"
              ? "border-malachite bg-malachite/10 text-malachite font-medium"
              : "border-gris/30 text-gris hover:bg-blanc-casse"
          }`}
        >
          URL Sessionize
        </button>
        <button
          onClick={() => setSource("json")}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            source === "json"
              ? "border-malachite bg-malachite/10 text-malachite font-medium"
              : "border-gris/30 text-gris hover:bg-blanc-casse"
          }`}
        >
          Coller le JSON
        </button>
      </div>

      {source === "url" ? (
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">
            URL de l&apos;API Sessionize
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://sessionize.com/api/v2/XXXXXXXX/view/All"
            className={inputClass}
          />
          <span className="block text-xs text-gris mt-1">
            Endpoint «&nbsp;All&nbsp;» de votre événement Sessionize (format JSON).
          </span>
        </label>
      ) : (
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">
            JSON exporté
          </span>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={10}
            placeholder='{ "sessions": [...], "speakers": [...], "categories": [...] }'
            className={`${inputClass} font-mono text-xs`}
          />
        </label>
      )}

      <button
        onClick={handleImport}
        disabled={!canImport}
        className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
      >
        {isImporting ? "Import en cours…" : "Lancer l'import"}
      </button>

      {error && (
        <div className="rounded-lg border border-terre-cuite/30 bg-terre-cuite/5 p-4 text-sm text-terre-cuite">
          {error}
        </div>
      )}

      {report && (
        <div className="rounded-lg border border-malachite/30 bg-malachite/5 p-4 space-y-2">
          <p className="font-medium text-noir">Import terminé&nbsp;:</p>
          <ul className="text-sm text-noir space-y-1">
            <li>
              Speakers&nbsp;: <strong>{report.speakers.created}</strong> créés,{" "}
              <strong>{report.speakers.updated}</strong> mis à jour
            </li>
            <li>
              Sessions&nbsp;: <strong>{report.talks.created}</strong> créées,{" "}
              <strong>{report.talks.updated}</strong> mises à jour, dont{" "}
              <strong>{report.talks.scheduled}</strong> avec un créneau
            </li>
            <li>
              Catégories&nbsp;: <strong>{report.categories.created}</strong> créées,{" "}
              <strong>{report.categories.reused}</strong> réutilisées
            </li>
            <li>
              Liens sociaux importés&nbsp;: <strong>{report.links}</strong>
            </li>
          </ul>
          {report.warnings.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-medium text-terre-cuite">
                Avertissements ({report.warnings.length})&nbsp;:
              </p>
              <ul className="text-xs text-gris list-disc pl-5 mt-1 space-y-0.5">
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {report && (report.absent.talks.length > 0 || report.absent.speakers.length > 0) && (
        <section
          aria-labelledby="import-absent-title"
          className="rounded-lg border border-gris/30 bg-blanc-casse p-4 space-y-3"
        >
          <div>
            <h3 id="import-absent-title" className="font-medium text-noir">
              Absents de l&apos;import
            </h3>
            <p className="text-sm text-gris mt-1">
              Présents sur le site pour cette édition, mais pas dans Sessionize&nbsp;: désistement,
              session annulée, ou fiche créée à la main. Rien n&apos;a été modifié&nbsp;; dépubliez ou
              mettez à la corbeille ce qui doit l&apos;être.
            </p>
          </div>
          {report.absent.talks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-noir">Sessions ({report.absent.talks.length})</p>
              <ul className="text-sm text-noir list-disc pl-5 mt-1 space-y-0.5">
                {report.absent.talks.map((talk) => (
                  <li key={talk.id}>
                    <Link href={`/admin/talks/${talk.id}`} className="text-malachite underline">
                      {talk.title}
                    </Link>{" "}
                    <span className="text-gris">
                      ({statusLabel(talk.publicationStatus)}
                      {talk.startsAt &&
                        `, créneau à réaffecter : ${formatEventTime(talk.startsAt)}${talk.roomLabel ? `, ${talk.roomLabel}` : ""}`}
                      )
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.absent.speakers.length > 0 && (
            <div>
              <p className="text-sm font-medium text-noir">Speakers ({report.absent.speakers.length})</p>
              <ul className="text-sm text-noir list-disc pl-5 mt-1 space-y-0.5">
                {report.absent.speakers.map((speaker) => (
                  <li key={speaker.id}>
                    <Link href={`/admin/speakers/${speaker.id}`} className="text-malachite underline">
                      {speaker.name}
                    </Link>{" "}
                    <span className="text-gris">({statusLabel(speaker.publicationStatus)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <SessionizeRoomPairing editionId={editionId} refreshKey={importCount} />
    </div>
  );
}
