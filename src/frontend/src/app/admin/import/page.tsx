"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import ImportTab from "@/components/admin/edition-detail/ImportTab";

export default function ImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      if (data) {
        setEditions(data);
        const preset = Number(searchParams.get("editionId"));
        const chosen = data.find((e) => e.id === preset) ?? data[0];
        if (chosen) setEditionId(chosen.id);
      }
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-noir">Import Sessionize</h1>
        <p className="mt-1 text-sm text-gris">Importez speakers et sessions dans une édition.</p>
      </div>

      <div className="bg-blanc rounded-xl shadow-card p-6 space-y-6">
        <label className="block max-w-[240px]">
          <span className="block text-sm font-medium text-noir mb-1">Édition cible *</span>
          <select
            value={editionId ?? ""}
            onChange={(e) => setEditionId(Number(e.target.value))}
            className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            {editions.map((e) => (
              <option key={e.id} value={e.id}>{e.year}</option>
            ))}
          </select>
        </label>

        {editionId && <ImportTab editionId={editionId} />}
      </div>
    </div>
  );
}
