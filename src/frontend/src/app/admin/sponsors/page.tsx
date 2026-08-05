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

// The participation the admin is currently looking at. With no year filter a
// company may hold several, in which case the most recent one is shown — the
// API sorts `editions` newest first. Mirrors the speakers list, where the same
// question arose first (#351).
//
// Falls back to the flattened fields when `editions` is missing, so a row keeps
// rendering rather than showing "—" if the payload ever narrows.
function currentParticipation(sponsor: SponsorRow, year: string) {
  const participations = sponsor.editions ?? [];
  if (!year) return participations[0];
  return participations.find((e) => String(e.edition.year) === year);
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
    // publicationStatus lives on the participation (#129), so an edition has to
    // be picked: applying to every edition a sponsor appears in would publish
    // it on a year the admin was not even looking at (the guard #351
    // established for speakers).
    const editionId = selectedEditionId;
    if (!editionId) {
      setError("Choisissez une édition avant d'appliquer une action groupée.");
      return;
    }

    setError(null);
    const ids = [...selectedIds];
    const { status, error: apiError } = await adminFetch("/sponsors/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action: "setStatus", value, editionId }),
    });
    if (status !== 200) {
      setError(apiError ?? "Action groupée impossible.");
      return;
    }
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

  // Every year the listed companies took part in, not just their latest one: a
  // sponsor spans editions since #129, so reading the flattened `edition` would
  // hide years from the picker and drop rows from the filter (#395).
  const years = useMemo(
    () => [...new Set(sponsors.flatMap((s) => (s.editions ?? []).map((e) => e.edition.year)))].sort((a, b) => b - a),
    [sponsors],
  );

  // The edition the bulk actions apply to, read off the year filter.
  const selectedEditionId = year
    ? (sponsors.flatMap((s) => s.editions ?? []).find((e) => String(e.edition.year) === year)?.editionId ?? null)
    : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sponsors.filter((s) => {
      if (year && !(s.editions ?? []).some((e) => String(e.edition.year) === year)) return false;
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
    {
      key: "tier",
      label: "Niveau",
      render: (s: SponsorRow) => currentParticipation(s, year)?.tier?.nameFr ?? s.tier?.nameFr ?? "—",
    },
    {
      key: "status",
      label: "Statut",
      render: (s: SponsorRow) => {
        // Publication is per participation (#129): a company published in 2026
        // may still be a draft for 2025.
        const status = currentParticipation(s, year)?.publicationStatus ?? s.publicationStatus;
        return (
          <StatusBadge
            status={status === "PUBLISHED" ? "Publié" : "Brouillon"}
            variant={status === "PUBLISHED" ? "green" : "gray"}
          />
        );
      },
    },
    {
      key: "edition",
      label: "Édition",
      render: (s: SponsorRow) => currentParticipation(s, year)?.edition.year ?? s.edition?.year ?? "—",
    },
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

          {selectedIds.size > 0 && !selectedEditionId && (
            <div role="status" className="mb-4 rounded-lg bg-jaune/10 px-4 py-3 text-sm text-noir">
              Les actions groupées s&apos;appliquent à une édition : choisissez une année dans le
              filtre ci-dessus.
            </div>
          )}

          {selectedIds.size > 0 && selectedEditionId && (
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
