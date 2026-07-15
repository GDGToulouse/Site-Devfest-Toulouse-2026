"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Speaker } from "@/lib/types";
import DataTable from "@/components/admin/DataTable";
import BulkActionBar from "@/components/admin/BulkActionBar";
import StatusBadge from "@/components/admin/StatusBadge";

interface SpeakerRow extends Speaker {
  edition?: { id: number; year: number };
}

export default function SpeakersDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState<string>(searchParams.get("year") ?? "");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    adminFetch<SpeakerRow[]>("/speakers").then(({ data }) => {
      if (data) setSpeakers(data);
      setIsLoading(false);
    });
  }, []);

  async function applyBulk(action: "setStatus" | "setFeatured", value: "DRAFT" | "PUBLISHED" | boolean) {
    const ids = [...selectedIds];
    const { status } = await adminFetch("/speakers/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action, value }),
    });
    if (status !== 200) return;
    setSpeakers((prev) =>
      prev.map((s) =>
        selectedIds.has(s.id)
          ? action === "setStatus"
            ? { ...s, publicationStatus: value as "DRAFT" | "PUBLISHED" }
            : { ...s, isFeatured: value as boolean }
          : s,
      ),
    );
    setSelectedIds(new Set());
  }

  const years = useMemo(
    () => [...new Set(speakers.map((s) => s.edition?.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [speakers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return speakers.filter((s) => {
      if (year && String(s.edition?.year) !== year) return false;
      if (q && !s.name.toLowerCase().includes(q) && !(s.company ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [speakers, year, search]);

  // Reset the selection whenever the filter changes so the header checkbox
  // and the bulk bar always reflect the currently visible rows.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [year, search]);

  const columns = [
    {
      key: "name",
      label: "Speaker",
      render: (s: SpeakerRow) => (
        <span className="font-medium text-noir">{s.name}</span>
      ),
    },
    { key: "company", label: "Société", render: (s: SpeakerRow) => s.company ?? "—" },
    {
      key: "status",
      label: "Statut",
      render: (s: SpeakerRow) => (
        <StatusBadge
          status={s.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
          variant={s.publicationStatus === "PUBLISHED" ? "green" : "gray"}
        />
      ),
    },
    { key: "featured", label: "À la une", render: (s: SpeakerRow) => (s.isFeatured ? "★" : "") },
    { key: "edition", label: "Édition", render: (s: SpeakerRow) => s.edition?.year ?? "—" },
  ];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Speakers</h1>
          <p className="mt-1 text-sm text-gris">Toutes éditions confondues.</p>
        </div>
        <button
          onClick={() => router.push("/admin/speakers/new")}
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
              placeholder="Rechercher un nom, une société…"
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
            <span className="text-sm text-gris">{filtered.length} speaker{filtered.length > 1 ? "s" : ""}</span>
          </div>

          {selectedIds.size > 0 && (
            <BulkActionBar
              count={selectedIds.size}
              entitySingular="speaker"
              entityPlural="speakers"
              onSetStatus={(value) => applyBulk("setStatus", value)}
              onSetFeatured={(value) => applyBulk("setFeatured", value)}
              onClear={() => setSelectedIds(new Set())}
            />
          )}

          <DataTable<SpeakerRow>
            columns={columns}
            data={filtered}
            emptyMessage="Aucun speaker"
            onEdit={(s) => router.push(`/admin/speakers/${s.id}`)}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </>
      )}
    </div>
  );
}
