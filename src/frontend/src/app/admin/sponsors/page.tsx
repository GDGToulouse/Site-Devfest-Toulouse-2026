"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor, SponsorLevel } from "@/lib/types";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";

interface SponsorRow extends Sponsor {
  edition?: { id: number; year: number };
}

const LEVEL_LABELS: Record<SponsorLevel, string> = {
  PLATINUM: "Platinum",
  GOLD: "Gold",
  SILVER: "Silver",
  SOUTIEN: "Soutien",
  COMMUNAUTE: "Communauté",
};

export default function SponsorsDataPage() {
  const router = useRouter();
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminFetch<SponsorRow[]>("/sponsors").then(({ data }) => {
      if (data) setSponsors(data);
      setIsLoading(false);
    });
  }, []);

  const years = useMemo(
    () => [...new Set(sponsors.map((s) => s.edition?.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [sponsors],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sponsors.filter((s) => {
      if (year && String(s.edition?.year) !== year) return false;
      if (level && s.level !== level) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sponsors, year, level, search]);

  const columns = [
    { key: "name", label: "Sponsor", render: (s: SponsorRow) => <span className="font-medium text-noir">{s.name}</span> },
    { key: "level", label: "Niveau", render: (s: SponsorRow) => LEVEL_LABELS[s.level] },
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
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              <option value="">Tous les niveaux</option>
              {(Object.keys(LEVEL_LABELS) as SponsorLevel[]).map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
              ))}
            </select>
            <span className="text-sm text-gris">{filtered.length} sponsor{filtered.length > 1 ? "s" : ""}</span>
          </div>

          <DataTable<SponsorRow>
            columns={columns}
            data={filtered}
            emptyMessage="Aucun sponsor"
            onEdit={(s) => router.push(`/admin/sponsors/${s.id}`)}
          />
        </>
      )}
    </div>
  );
}
