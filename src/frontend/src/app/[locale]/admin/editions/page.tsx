"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface EditionData {
  id: number;
  year: number;
  status: string;
  ticketTiersCount: number;
  articlesCount: number;
}

const STATUS_OPTIONS: Record<string, { label: string; variant: "green" | "orange" | "gray" }> = {
  PREPARATION: { label: "Preparation", variant: "gray" },
  ANNOUNCEMENT: { label: "Annonce", variant: "green" },
  SEE_YOU_NEXT_YEAR: { label: "A l'annee prochaine", variant: "orange" },
};

export default function EditionsPage() {
  const router = useRouter();
  const [editions, setEditions] = useState<EditionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newYear, setNewYear] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditionData | null>(null);

  async function loadEditions() {
    setIsLoading(true);
    const { data } = await adminFetch<EditionData[]>("/editions");
    if (data) setEditions(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadEditions();
  }, []);

  async function handleCreate() {
    const year = Number(newYear);
    if (!year || year < 2016 || year > 2100) {
      setError("Annee invalide");
      return;
    }
    setIsCreating(true);
    setError(null);
    const { status } = await adminFetch("/editions", {
      method: "POST",
      body: JSON.stringify({ year }),
    });
    if (status === 409) {
      setError("Une edition pour cette annee existe deja");
    } else {
      setNewYear("");
    }
    setIsCreating(false);
    loadEditions();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { status, data } = await adminFetch<{ error?: string }>(`/editions/${deleteTarget.id}`, { method: "DELETE" });
    if (status === 409) {
      setError(data?.error || "Impossible de supprimer cette edition");
    }
    setDeleteTarget(null);
    loadEditions();
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Editions</h1>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="Annee"
            className="w-24 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <button
            onClick={handleCreate}
            disabled={isCreating || !newYear}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isCreating ? "Creation..." : "Nouvelle edition"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
      )}

      <div className="space-y-3">
        {editions.map((edition) => {
          const statusInfo = STATUS_OPTIONS[edition.status] || { label: edition.status, variant: "gray" as const };
          return (
            <div key={edition.id} className="bg-blanc rounded-xl shadow-card p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-noir">DevFest {edition.year}</h2>
                <StatusBadge status={statusInfo.label} variant={statusInfo.variant} />
                <span className="text-xs text-gris">{edition.ticketTiersCount} tarif(s) · {edition.articlesCount} article(s)</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push(`/fr/admin/editions/${edition.id}`)}
                  className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90"
                >
                  Gerer
                </button>
                <button
                  onClick={() => setDeleteTarget(edition)}
                  className="p-2 rounded-lg text-terre-cuite hover:bg-terre-cuite/10 transition-colors"
                  title="Supprimer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'edition"
        message={`Supprimer l'edition DevFest ${deleteTarget?.year} ? Les chiffres cles et tarifs associes seront aussi supprimes.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
