"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import type { Category } from "@/lib/types";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const COLOR_PRESETS = ["#109E6E", "#EC6839", "#509EE3", "#F8AB06", "#EE7CAD", "#9A6CB8"];

const emptyForm = { nameFr: "", nameEn: "", color: "#109E6E", sortOrder: "0" };

interface CategoriesTabProps {
  editionId: number;
}

export default function CategoriesTab({ editionId }: CategoriesTabProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data } = await adminFetch<Category[]>(`/categories?editionId=${editionId}`);
    if (data) setCategories(data);
    setIsLoading(false);
  }, [editionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, sortOrder: String(categories.length) });
    setShowForm(true);
  }

  function openEdit(c: Category) {
    setEditingId(c.id);
    setForm({ nameFr: c.nameFr, nameEn: c.nameEn, color: c.color, sortOrder: String(c.sortOrder) });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.nameFr.trim() || !form.nameEn.trim()) return;
    setIsSaving(true);
    const payload = {
      editionId,
      nameFr: form.nameFr.trim(),
      nameEn: form.nameEn.trim(),
      color: form.color,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (editingId) {
      await adminFetch(`/categories/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await adminFetch("/categories", { method: "POST", body: JSON.stringify(payload) });
    }
    setIsSaving(false);
    setShowForm(false);
    void load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/categories/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    void load();
  }

  if (isLoading) return <p className="py-12 text-center text-gris">Chargement…</p>;

  const inputClass =
    "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-noir">Catégories ({categories.length})</h2>
        {!showForm && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
          >
            + Ajouter une catégorie
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-gris/20 rounded-lg p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Nom (FR) *</span>
              <input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Nom (EN) *</span>
              <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={inputClass} />
            </label>
          </div>

          <div>
            <span className="block text-sm font-medium text-noir mb-1">Couleur</span>
            <div className="flex items-center gap-3">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-full border-2 ${form.color === c ? "border-noir" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-8 w-12 rounded border border-gris/30"
              />
            </div>
          </div>

          <label className="block max-w-[160px]">
            <span className="block text-sm font-medium text-noir mb-1">Ordre</span>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !form.nameFr.trim() || !form.nameEn.trim()}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <p className="py-8 text-center text-gris text-sm">Aucune catégorie pour cette édition.</p>
      ) : (
        <ul className="divide-y divide-gris/10">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-4 py-3">
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="flex-1 text-noir">
                {c.nameFr} <span className="text-gris">/ {c.nameEn}</span>
              </span>
              <button onClick={() => openEdit(c)} className="text-sm text-bleu hover:underline">Éditer</button>
              <button onClick={() => setDeleteTarget(c)} className="text-sm text-terre-cuite hover:underline">Supprimer</button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer cette catégorie ?"
        message={`« ${deleteTarget?.nameFr} » sera supprimée. Les sessions associées perdront leur catégorie.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
