"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Category } from "@/lib/types";
import DataTable from "@/components/admin/DataTable";

// A track is shared across editions since #338, so a row carries the list of
// years proposing it rather than a single edition.
interface CategoryRow extends Category {
  editions: { id: number; year: number; sortOrder: number }[];
}

export default function CategoriesDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState<string>(searchParams.get("year") ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminFetch<CategoryRow[]>("/categories").then(({ data }) => {
      if (data) setCategories(data);
      setIsLoading(false);
    });
  }, []);

  const years = useMemo(
    () =>
      [...new Set(categories.flatMap((c) => c.editions.map((e) => e.year)))].sort((a, b) => b - a),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      // A track matches the year filter as soon as one of its editions does.
      if (year && !c.editions.some((e) => String(e.year) === year)) return false;
      if (q && !c.nameFr.toLowerCase().includes(q) && !c.nameEn.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categories, year, search]);

  const columns = [
    {
      key: "name",
      label: "Catégorie",
      render: (c: CategoryRow) => (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
          <span className="font-medium text-noir">{c.nameFr}</span>
          <span className="text-gris">/ {c.nameEn}</span>
        </span>
      ),
    },
    {
      key: "editions",
      label: "Éditions",
      render: (c: CategoryRow) =>
        c.editions.length > 0 ? c.editions.map((e) => e.year).join(", ") : "—",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Catégories</h1>
          <p className="mt-1 text-sm text-gris">Toutes éditions confondues.</p>
        </div>
        <button
          onClick={() => router.push("/admin/categories/new")}
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
              placeholder="Rechercher une catégorie…"
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
            <span className="text-sm text-gris">{filtered.length} catégorie{filtered.length > 1 ? "s" : ""}</span>
          </div>

          <DataTable<CategoryRow>
            columns={columns}
            data={filtered}
            emptyMessage="Aucune catégorie"
            onEdit={(c) => router.push(`/admin/categories/${c.id}`)}
          />
        </>
      )}
    </div>
  );
}
