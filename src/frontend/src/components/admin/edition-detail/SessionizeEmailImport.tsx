"use client";

import { useState } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";

// The speakers' contact addresses from the Excel export of Sessionize's
// organizer app (#866): the API never gives them out. Only empty addresses
// are filled, and nothing is sent to anyone.

export interface EmailImportReport {
  added: string[];
  unchanged: string[];
  different: Array<{ name: string; current: string; file: string }>;
  notFound: string[];
  invalid: string[];
}

const names = (list: string[]) => list.join(", ");

export default function SessionizeEmailImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [report, setReport] = useState<EmailImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setIsImporting(true);
    setReport(null);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const result = await adminFetch<EmailImportReport>("/import/sessionize/emails", { method: "POST", body: form });
    setIsImporting(false);
    if (result.status !== 200 || !result.data) {
      // Stays on screen: a failure that fades reads as a success (#394).
      setError(humanError(result, "L'import des adresses a échoué. Réessayez."));
      return;
    }
    setReport(result.data);
  }

  return (
    <section aria-labelledby="sessionize-emails-title" className="space-y-3 border-t border-gris/20 pt-6">
      <div>
        <h2 id="sessionize-emails-title" className="text-lg font-bold text-noir">
          Adresses des speakers
        </h2>
        <p className="text-sm text-gris mt-1">
          L&apos;API Sessionize ne donne pas les adresses e-mail. Exportez les sessions depuis Sessionize au format
          Excel (.xlsx), puis déposez le fichier ici&nbsp;: seules les adresses vides sont complétées, une adresse déjà
          saisie sur le site est gardée. Rien n&apos;est envoyé aux speakers.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-noir">
          <span className="sr-only">Export Excel de Sessionize</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setError(null);
            }}
            // Tailwind's reset strips the native button of its border and
            // background: styled here, as in the guests' CSV import (#871).
            className="text-sm text-noir file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-malachite file:bg-malachite/10 file:px-4 file:py-2 file:font-medium file:text-malachite hover:file:bg-malachite/20"
          />
        </label>
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || isImporting}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isImporting ? "Import en cours…" : "Compléter les adresses"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-terre-cuite/30 bg-terre-cuite/5 p-4 text-sm text-terre-cuite">
          {error}
        </p>
      )}

      {report && (
        <div role="status" className="rounded-lg border border-malachite/30 bg-malachite/5 p-4 space-y-2 text-sm text-noir">
          <p className="font-medium">
            {report.added.length > 0
              ? `${report.added.length} adresse${report.added.length > 1 ? "s" : ""} ajoutée${report.added.length > 1 ? "s" : ""}.`
              : "Aucune adresse ajoutée."}
          </p>
          <ul className="space-y-1">
            {report.added.length > 0 && <li>Complétées&nbsp;: {names(report.added)}</li>}
            {report.unchanged.length > 0 && <li>Déjà à jour&nbsp;: {report.unchanged.length}</li>}
            {report.different.length > 0 && (
              <li>
                Adresse différente sur le site, gardée&nbsp;:
                <ul className="list-disc pl-5 mt-1">
                  {report.different.map((d) => (
                    <li key={d.name}>
                      {d.name}&nbsp;: {d.current} sur le site, {d.file} dans Sessionize
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {report.notFound.length > 0 && <li>Introuvables sur le site&nbsp;: {names(report.notFound)}</li>}
            {report.invalid.length > 0 && <li>Sans adresse valable dans le fichier&nbsp;: {names(report.invalid)}</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
