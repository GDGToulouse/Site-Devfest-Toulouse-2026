"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";
import BilingualInput from "@/components/admin/BilingualInput";

interface PageSummary {
  id: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  updatedAt: string;
}

interface PageDetail extends PageSummary {
  contentFr: string;
  contentEn: string;
}

export default function PagesAdminPage() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [editing, setEditing] = useState<PageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadPages() {
    setIsLoading(true);
    const { data } = await adminFetch<PageSummary[]>("/pages");
    if (data) setPages(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadPages();
  }, []);

  async function startEdit(page: PageSummary) {
    const { data } = await adminFetch<PageDetail>(`/pages/${page.id}`);
    if (data) setEditing(data);
  }

  async function handleSave() {
    if (!editing) return;
    setIsSaving(true);
    await adminFetch(`/pages/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        titleFr: editing.titleFr,
        titleEn: editing.titleEn,
        contentFr: editing.contentFr,
        contentEn: editing.contentEn,
      }),
    });
    setIsSaving(false);
    setEditing(null);
    loadPages();
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-8">Pages de contenu</h1>

      {editing ? (
        <div className="bg-blanc rounded-xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-noir">Modifier : {editing.slug}</h2>
            <button onClick={() => setEditing(null)} className="text-sm text-gris hover:text-noir">Annuler</button>
          </div>

          <BilingualInput label="Titre" nameFr="titleFr" nameEn="titleEn" valueFr={editing.titleFr} valueEn={editing.titleEn} onChangeFr={(v) => setEditing({ ...editing, titleFr: v })} onChangeEn={(v) => setEditing({ ...editing, titleEn: v })} required />

          <BilingualInput label="Contenu (HTML)" nameFr="contentFr" nameEn="contentEn" valueFr={editing.contentFr} valueEn={editing.contentEn} onChangeFr={(v) => setEditing({ ...editing, contentFr: v })} onChangeEn={(v) => setEditing({ ...editing, contentEn: v })} multiline rows={15} />

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50">
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gris/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blanc-casse border-b border-gris/20">
                <th className="text-left px-4 py-3 font-medium text-gris">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-gris">Titre (FR)</th>
                <th className="text-left px-4 py-3 font-medium text-gris">Mis a jour</th>
                <th className="text-right px-4 py-3 font-medium text-gris">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-gris/10 hover:bg-blanc-casse/50">
                  <td className="px-4 py-3 text-noir font-medium">/{page.slug}</td>
                  <td className="px-4 py-3 text-noir">{page.titleFr}</td>
                  <td className="px-4 py-3 text-gris text-xs">{new Date(page.updatedAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(page)} className="text-bleu hover:underline text-sm">Modifier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
