"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import CategoryForm, { emptyCategoryForm, type CategoryFormValue } from "@/components/admin/categories/CategoryForm";

interface CategoryData {
  id: number;
  nameFr: string;
  nameEn: string;
  color: string;
  // A track is shared across editions since #338.
  editions: { id: number; year: number; sortOrder: number }[];
}

export default function CategoryEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = params.id === "new";
  const categoryId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<CategoryFormValue>(emptyCategoryForm);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The edition list drives the selector in both modes now that a track can
    // belong to several years.
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      if (data) setEditions(data);
    });

    if (isNew) {
      const preset = Number(searchParams.get("editionId"));
      if (preset) setForm((f) => ({ ...f, editionIds: [preset] }));
    } else if (categoryId) {
      adminFetch<CategoryData>(`/categories/${categoryId}`).then(({ data, status }) => {
        if (status === 404 || !data) {
          router.push("/admin/categories");
          return;
        }
        setForm({
          nameFr: data.nameFr,
          nameEn: data.nameEn,
          color: data.color,
          editionIds: data.editions.map((e) => e.id),
        });
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, isNew]);

  async function handleSave() {
    if (!form.nameFr.trim() || !form.nameEn.trim()) return;
    setIsSaving(true);
    setError(null);
    const payload = {
      nameFr: form.nameFr.trim(),
      nameEn: form.nameEn.trim(),
      color: form.color,
      editionIds: form.editionIds,
    };
    const { data, status, error: apiError } = isNew
      ? await adminFetch<{ id: number }>("/categories", { method: "POST", body: JSON.stringify(payload) })
      : await adminFetch<{ id: number }>(`/categories/${categoryId}`, { method: "PUT", body: JSON.stringify(payload) });
    setIsSaving(false);

    if (status === 409) {
      // The name identifies the track globally: say so rather than a generic failure.
      setError(apiError ?? "Une catégorie porte déjà ce nom.");
      return;
    }
    if (status >= 400 || (isNew && !data)) {
      setError(apiError ?? (isNew ? "Échec de la création." : "Échec de l'enregistrement."));
      return;
    }
    router.push(isNew && data ? `/admin/categories/${data.id}` : "/admin/categories");
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/categories")} className="text-gris hover:text-noir" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouvelle catégorie" : "Modifier la catégorie"}</h1>
      </div>

      <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
        <CategoryForm value={form} onChange={setForm} editions={editions} />

        {error && <p role="alert" aria-live="assertive" className="text-sm text-terre-cuite">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !form.nameFr.trim() || !form.nameEn.trim()}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            onClick={() => router.push("/admin/categories")}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
