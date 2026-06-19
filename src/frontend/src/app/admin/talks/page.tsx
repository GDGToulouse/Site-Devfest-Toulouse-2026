"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Talk, TalkFormat } from "@/lib/types";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";

interface TalkRow extends Talk {
  edition?: { id: number; year: number };
}

const FORMAT_LABELS: Record<TalkFormat, string> = {
  CONFERENCE: "Conférence",
  QUICKIE: "Quickie",
  KEYNOTE: "Keynote",
};

export default function TalksDataPage() {
  const router = useRouter();
  const [talks, setTalks] = useState<TalkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminFetch<TalkRow[]>("/talks").then(({ data }) => {
      if (data) setTalks(data);
      setIsLoading(false);
    });
  }, []);

  const years = useMemo(
    () => [...new Set(talks.map((t) => t.edition?.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [talks],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return talks.filter((t) => {
      if (year && String(t.edition?.year) !== year) return false;
      if (format && t.format !== format) return false;
      if (q && !t.titleFr.toLowerCase().includes(q) && !t.speakers.some((s) => s.name.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [talks, year, format, search]);

  const columns = [
    { key: "title", label: "Titre", render: (t: TalkRow) => <span className="font-medium text-noir">{t.titleFr}</span> },
    { key: "format", label: "Format", render: (t: TalkRow) => FORMAT_LABELS[t.format] },
    {
      key: "category",
      label: "Catégorie",
      render: (t: TalkRow) =>
        t.category ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.category.color }} />
            {t.category.nameFr}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "speakers",
      label: "Speakers",
      render: (t: TalkRow) => (t.speakers.length ? t.speakers.map((s) => s.name).join(", ") : "—"),
    },
    {
      key: "status",
      label: "Statut",
      render: (t: TalkRow) => (
        <StatusBadge
          status={t.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
          variant={t.publicationStatus === "PUBLISHED" ? "green" : "gray"}
        />
      ),
    },
    { key: "edition", label: "Édition", render: (t: TalkRow) => t.edition?.year ?? "—" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-noir">Conférences</h1>
        <p className="mt-1 text-sm text-gris">Toutes éditions confondues. La modification se fait dans l&apos;édition concernée.</p>
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
              placeholder="Rechercher un titre, un speaker…"
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
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
            >
              <option value="">Tous les formats</option>
              {(Object.keys(FORMAT_LABELS) as TalkFormat[]).map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
            <span className="text-sm text-gris">{filtered.length} conférence{filtered.length > 1 ? "s" : ""}</span>
          </div>

          <DataTable<TalkRow>
            columns={columns}
            data={filtered}
            emptyMessage="Aucune conférence"
            onEdit={(t) => router.push(`/admin/editions/${t.editionId}?tab=conferences`)}
          />
        </>
      )}
    </div>
  );
}
