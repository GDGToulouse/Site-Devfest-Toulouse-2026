"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import StatusBadge from "@/components/admin/StatusBadge";

interface TierCount {
  ticketTierId: number;
  name: string;
  isOutsideFlow: boolean;
  expected: number;
  cancelled: number;
}

interface AttendeeSummary {
  billetwebEventId: string | null;
  syncedAt: string | null;
  expected: number;
  cancelled: number;
  outsideFlow: number;
  withoutTier: number;
  byTier: TierCount[];
}

interface ImportReport {
  isIncremental: boolean;
  received: number;
  created: number;
  updated: number;
  cancelled: number;
  unchanged: number;
  withoutTier: number;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The attendees of the edition, imported from its Billetweb event (#638). Counts
// only: the import is checked here, people are looked up on the arrivals screens.
export default function ArrivalsTab({ editionId }: { editionId: number }) {
  const [summary, setSummary] = useState<AttendeeSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function loadSummary() {
    const { data } = await adminFetch<AttendeeSummary>(`/attendees/summary/${editionId}`);
    if (data) setSummary(data);
  }

  useEffect(() => {
    loadSummary();
  }, [editionId]);

  async function handleImport() {
    setIsImporting(true);
    setImportError(null);
    setReport(null);
    const { data, status, error } = await adminFetch<ImportReport>(`/attendees/import/${editionId}`, {
      method: "POST",
    });
    setIsImporting(false);
    if (status === 201 && data) {
      setReport(data);
      loadSummary();
    } else {
      setImportError(error || "L'import des participants a échoué. Réessayez dans une minute.");
    }
  }

  if (!summary) return <p className="text-gris text-sm">Chargement…</p>;

  const isLinked = summary.billetwebEventId !== null;
  const badgeFlow = summary.expected - summary.outsideFlow - summary.withoutTier;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-noir">Participants</h3>
        <button
          onClick={handleImport}
          disabled={!isLinked || isImporting}
          className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90 disabled:opacity-50"
        >
          {isImporting ? "Import en cours…" : "Importer depuis Billetweb"}
        </button>
      </div>

      <p className="text-sm text-gris mb-4">
        {!isLinked
          ? "L'édition n'est liée à aucun événement Billetweb : importez d'abord ses tarifs, onglet Billetterie."
          : summary.syncedAt
            ? `Dernier import le ${formatDateTime(summary.syncedAt)}. Le suivant ne reprend que ce qui a changé depuis.`
            : "Aucun import pour l'instant."}
      </p>

      {importError && (
        <div role="alert" className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
          {importError}
        </div>
      )}

      {report && (
        <div role="status" className="p-3 rounded-lg bg-malachite/10 text-noir text-sm mb-4">
          {report.isIncremental ? "Import des changements" : "Premier import"} : {report.created} nouveaux,{" "}
          {report.updated} mis à jour dont {report.cancelled} annulés, {report.unchanged} inchangés.
        </div>
      )}

      {summary.withoutTier > 0 && (
        <div className="p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm mb-4">
          {summary.withoutTier} billets portent un tarif que le site ne connaît pas : réimportez les tarifs,
          onglet Billetterie, puis relancez cet import.
        </div>
      )}

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Attendus", value: summary.expected },
          { label: "Aux guichets", value: badgeFlow },
          { label: "Accueil dédié", value: summary.outsideFlow },
          { label: "Annulés ou remboursés", value: summary.cancelled },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gris/20 p-4">
            <dt className="text-xs text-gris">{stat.label}</dt>
            <dd className="text-2xl font-bold text-noir">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {summary.byTier.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gris/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blanc-casse/60 border-b border-gris/20">
                <th className="text-left px-4 py-3 font-medium text-gris">Tarif</th>
                <th className="text-right px-4 py-3 font-medium text-gris">Attendus</th>
                <th className="text-right px-4 py-3 font-medium text-gris">Annulés</th>
              </tr>
            </thead>
            <tbody>
              {summary.byTier.map((tier) => (
                <tr key={tier.ticketTierId} className="border-b border-gris/10">
                  <td className="px-4 py-3 text-noir">
                    {tier.name}
                    {tier.isOutsideFlow && (
                      <span className="ml-2">
                        <StatusBadge status="Hors flux" variant="blue" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-noir">{tier.expected}</td>
                  <td className="px-4 py-3 text-right text-gris">{tier.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
