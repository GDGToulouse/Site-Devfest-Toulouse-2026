"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { AdminSponsorTier } from "@/lib/types";
import DataTable from "@/components/admin/DataTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

export default function SponsorTiersPage() {
  const router = useRouter();
  const [tiers, setTiers] = useState<AdminSponsorTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminSponsorTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<AdminSponsorTier[]>("/sponsor-tiers").then(({ data }) => {
      if (data) setTiers(data);
      setIsLoading(false);
    });
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    const { status, error: apiError } = await adminFetch(`/sponsor-tiers/${deleteTarget.id}`, { method: "DELETE" });
    const deletedId = deleteTarget.id;
    setDeleteTarget(null);

    if (status === 204) {
      setTiers((prev) => prev.filter((t) => t.id !== deletedId));
      return;
    }
    // The API refuses (409) while sponsors or editions still point at the offer.
    if (status === 409) {
      setError("Cette offre est encore utilisée par des sponsors ou des éditions : détachez-la avant de la supprimer.");
      return;
    }
    setError(apiError ?? "Suppression impossible.");
  }

  const columns = [
    {
      key: "color",
      label: "Couleur",
      render: (t: AdminSponsorTier) => (
        <span className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: t.color }} />
      ),
    },
    { key: "name", label: "Offre", render: (t: AdminSponsorTier) => <span className="font-medium text-noir">{t.nameFr}</span> },
    { key: "rank", label: "Rang", render: (t: AdminSponsorTier) => t.rank },
    { key: "quota", label: "Quota offres", render: (t: AdminSponsorTier) => t.jobOfferQuota },
    { key: "promo", label: "Idées promo", render: (t: AdminSponsorTier) => (t.allowsPromoIdeas ? "✓" : "—") },
  ];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Offres de sponsoring</h1>
          <p className="mt-1 text-sm text-gris">Catalogue partagé entre toutes les éditions.</p>
        </div>
        <button
          onClick={() => router.push("/admin/sponsor-tiers/new")}
          className="shrink-0 px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          + Ajouter
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-terre-cuite/10 px-4 py-3 text-sm text-terre-cuite">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-gris">Chargement...</p>
      ) : (
        <DataTable<AdminSponsorTier>
          columns={columns}
          data={tiers}
          emptyMessage="Aucune offre dans le catalogue"
          onEdit={(t) => router.push(`/admin/sponsor-tiers/${t.id}`)}
          onDelete={(t) => setDeleteTarget(t)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'offre"
        message={`Supprimer « ${deleteTarget?.nameFr} » du catalogue ? Vous pourrez la restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
