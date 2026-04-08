"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  PREPARATION: { label: "Préparation", variant: "gray" },
  ANNOUNCEMENT: { label: "Annonce", variant: "green" },
  SEE_YOU_NEXT_YEAR: { label: "À l'année prochaine", variant: "orange" },
};

export default function EditionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.startsWith("/en") ? "en" : "fr";
  const [editions, setEditions] = useState<EditionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newYear, setNewYear] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditionData | null>(null);
  const [featuredId, setFeaturedId] = useState<number | null>(null);

  async function loadEditions() {
    setIsLoading(true);
    const [{ data }, { data: featured }] = await Promise.all([
      adminFetch<EditionData[]>("/editions"),
      adminFetch<{ editionId: number | null }>("/editions/featured"),
    ]);
    if (data) setEditions(data);
    if (featured) setFeaturedId(featured.editionId);
    setIsLoading(false);
  }

  useEffect(() => {
    loadEditions();
  }, []);

  async function handleCreate() {
    const year = Number(newYear);
    if (!year || year < 2016 || year > 2100) {
      setError("Année invalide");
      return;
    }
    setIsCreating(true);
    setError(null);
    const { status } = await adminFetch("/editions", {
      method: "POST",
      body: JSON.stringify({ year }),
    });
    if (status === 409) {
      setError("Une édition pour cette année existe déjà");
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
      setError(data?.error || "Impossible de supprimer cette édition");
    }
    setDeleteTarget(null);
    loadEditions();
  }

  async function handleSetFeatured(editionId: number) {
    await adminFetch("/editions/featured", {
      method: "PUT",
      body: JSON.stringify({ editionId }),
    });
    setFeaturedId(editionId);
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Éditions</h1>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="Année"
            className="w-24 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <button
            onClick={handleCreate}
            disabled={isCreating || !newYear}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isCreating ? "Création..." : "Nouvelle édition"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
      )}

      <div className="space-y-3">
        {editions.map((edition) => {
          const statusInfo = STATUS_OPTIONS[edition.status] || { label: edition.status, variant: "gray" as const };
          const isFeatured = edition.id === featuredId;
          return (
            <div key={edition.id} className={`bg-blanc rounded-xl shadow-card p-5 flex items-center justify-between ${isFeatured ? "ring-2 ring-malachite" : ""}`}>
              <div className="flex items-center gap-4 flex-wrap">
                <h2 className="text-xl font-bold text-noir">DevFest {edition.year}</h2>
                <StatusBadge status={statusInfo.label} variant={statusInfo.variant} />
                {isFeatured && <StatusBadge status="À la une" variant="green" />}
                <span className="text-xs text-gris">{edition.ticketTiersCount} tarif(s) · {edition.articlesCount} article(s)</span>
              </div>
              <div className="flex items-center gap-2">
                {!isFeatured && (
                  <button
                    onClick={() => handleSetFeatured(edition.id)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-malachite border border-malachite hover:bg-malachite/10 transition-colors"
                    title="Mettre à la une"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </button>
                )}
                <button
                  onClick={() => router.push(`/${locale}/admin/editions/${edition.id}`)}
                  className="px-4 py-2 bg-bleu text-blanc rounded-lg text-sm font-medium hover:bg-bleu/90"
                >
                  Gérer
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
        title="Supprimer l'édition"
        message={`Supprimer l'édition DevFest ${deleteTarget?.year} ? Les chiffres clés et tarifs associés seront aussi supprimés.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
