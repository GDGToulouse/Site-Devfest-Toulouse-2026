"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor, AdminSponsorTier } from "@/lib/types";
import DataTable from "@/components/admin/DataTable";
import BulkActionBar from "@/components/admin/BulkActionBar";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface SponsorRow extends Sponsor {
  edition?: { id: number; year: number };
}

export default function SponsorsDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [tiers, setTiers] = useState<AdminSponsorTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState<string>(searchParams.get("year") ?? "");
  const [tierKey, setTierKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SponsorRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<SponsorRow[]>("/sponsors").then(({ data }) => {
      if (data) setSponsors(data);
      setIsLoading(false);
    });
    // The offer filter lists the catalogue (#321) instead of a frozen enum.
    adminFetch<AdminSponsorTier[]>("/sponsor-tiers").then(({ data }) => {
      if (data) setTiers(data);
    });
  }, []);

  async function applyBulk(value: "DRAFT" | "PUBLISHED") {
    const ids = [...selectedIds];
    const { status } = await adminFetch("/sponsors/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action: "setStatus", value }),
    });
    if (status !== 200) return;
    setSponsors((prev) =>
      prev.map((s) => (selectedIds.has(s.id) ? { ...s, publicationStatus: value } : s)),
    );
    setSelectedIds(new Set());
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    // Soft-delete since #147: 204, the sponsor moves to the trash. Its contacts
    // and job offers go with it on the public side; the row itself is restorable.
    const { status, error: apiError } = await adminFetch(`/sponsors/${deleteTarget.id}`, {
      method: "DELETE",
    });
    const deletedId = deleteTarget.id;
    setDeleteTarget(null);

    if (status === 204) {
      setSponsors((prev) => prev.filter((s) => s.id !== deletedId));
      return;
    }
    setError(apiError ?? "Suppression impossible.");
  }

  const years = useMemo(
    () => [...new Set(sponsors.map((s) => s.edition?.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [sponsors],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sponsors.filter((s) => {
      if (year && String(s.edition?.year) !== year) return false;
      if (tierKey && s.tier?.key !== tierKey) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sponsors, year, tierKey, search]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [year, tierKey, search]);

  const columns = [
    { key: "name", label: "Sponsor", render: (s: SponsorRow) => <span className="font-medium text-noir">{s.name}</span> },
    { key: "tier", label: "Niveau", render: (s: SponsorRow) => s.tier?.nameFr ?? "—" },
    {
      key: "status",
      label: "Statut",
      render: (s: SponsorRow) => (
        <StatusBadge
          status={s.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
          variant={s.publicationStatus === "PUBLISHED" ? "green" : "gray"}
        />
      ),
    },
    { key: "edition", label: "Édition", render: (s: SponsorRow) => s.edition?.year ?? "—" },
  ];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Sponsors</h1>
          <p className="mt-1 text-sm text-gris">Toutes éditions confondues.</p>
        </div>
        <button
          onClick={() => router.push("/admin/sponsors/new")}
          className="shrink-0 px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          + Ajouter
        </button>
      </div>

      {isLoading ? (
        <p className="text-gris">Chargement...</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un sponsor…"
              className="w-64 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
            />
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              <option value="">Toutes les éditions</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={tierKey}
              onChange={(e) => setTierKey(e.target.value)}
              className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              <option value="">Tous les niveaux</option>
              {tiers.map((tier) => (
                <option key={tier.key} value={tier.key}>{tier.nameFr}</option>
              ))}
            </select>
            <span className="text-sm text-gris">{filtered.length} sponsor{filtered.length > 1 ? "s" : ""}</span>
          </div>

          {selectedIds.size > 0 && (
            <BulkActionBar
              count={selectedIds.size}
              entitySingular="sponsor"
              entityPlural="sponsors"
              onSetStatus={applyBulk}
              onClear={() => setSelectedIds(new Set())}
            />
          )}

          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-terre-cuite/10 px-4 py-3 text-sm text-terre-cuite">
              {error}
            </div>
          )}

          <DataTable<SponsorRow>
            columns={columns}
            data={filtered}
            emptyMessage="Aucun sponsor"
            onEdit={(s) => router.push(`/admin/sponsors/${s.id}`)}
            onDelete={(s) => setDeleteTarget(s)}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer le sponsor"
        message={`Supprimer « ${deleteTarget?.name} » ? Il disparaîtra des pages publiques. Vous pourrez le restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
