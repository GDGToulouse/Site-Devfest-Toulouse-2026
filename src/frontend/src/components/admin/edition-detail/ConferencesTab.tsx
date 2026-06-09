"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import type { Talk, TalkFormat, TalkLevel, Category, Speaker } from "@/lib/types";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const FORMATS: { value: TalkFormat; label: string }[] = [
  { value: "CONFERENCE", label: "Conférence (40 min)" },
  { value: "QUICKIE", label: "Quickie (15 min)" },
  { value: "KEYNOTE", label: "Keynote" },
];
const LEVELS: { value: TalkLevel; label: string }[] = [
  { value: "DEBUTANT", label: "Débutant" },
  { value: "INTERMEDIAIRE", label: "Intermédiaire" },
  { value: "CONFIRME", label: "Confirmé" },
];

const emptyForm = {
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  format: "CONFERENCE" as TalkFormat,
  level: "" as "" | TalkLevel,
  language: "fr",
  categoryId: "" as string,
  speakerIds: [] as number[],
  publicationStatus: "DRAFT" as "DRAFT" | "PUBLISHED",
};

interface ConferencesTabProps {
  editionId: number;
}

export default function ConferencesTab({ editionId }: ConferencesTabProps) {
  const [talks, setTalks] = useState<Talk[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Talk | null>(null);

  // Filters
  const [filterFormat, setFilterFormat] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLang, setFilterLang] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    const [{ data: t }, { data: c }, { data: s }] = await Promise.all([
      adminFetch<Talk[]>(`/talks?editionId=${editionId}`),
      adminFetch<Category[]>(`/categories?editionId=${editionId}`),
      adminFetch<Speaker[]>(`/speakers?editionId=${editionId}`),
    ]);
    if (t) setTalks(t);
    if (c) setCategories(c);
    if (s) setSpeakers(s);
    setIsLoading(false);
  }, [editionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      talks.filter(
        (t) =>
          (!filterFormat || t.format === filterFormat) &&
          (!filterCategory || String(t.categoryId) === filterCategory) &&
          (!filterLang || t.language === filterLang),
      ),
    [talks, filterFormat, filterCategory, filterLang],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(t: Talk) {
    setEditingId(t.id);
    setForm({
      titleFr: t.titleFr,
      titleEn: t.titleEn,
      descriptionFr: t.descriptionFr,
      descriptionEn: t.descriptionEn,
      format: t.format,
      level: t.level ?? "",
      language: t.language,
      categoryId: t.categoryId ? String(t.categoryId) : "",
      speakerIds: t.speakerIds,
      publicationStatus: t.publicationStatus,
    });
    setShowForm(true);
  }

  function toggleSpeaker(id: number) {
    setForm((f) => ({
      ...f,
      speakerIds: f.speakerIds.includes(id)
        ? f.speakerIds.filter((x) => x !== id)
        : [...f.speakerIds, id],
    }));
  }

  async function handleSave() {
    if (!form.titleFr.trim() || !form.titleEn.trim()) return;
    setIsSaving(true);
    const payload = {
      editionId,
      titleFr: form.titleFr.trim(),
      titleEn: form.titleEn.trim(),
      descriptionFr: form.descriptionFr,
      descriptionEn: form.descriptionEn,
      format: form.format,
      level: form.level || null,
      language: form.language,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      speakerIds: form.speakerIds,
      publicationStatus: form.publicationStatus,
    };
    if (editingId) {
      await adminFetch(`/talks/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await adminFetch("/talks", { method: "POST", body: JSON.stringify(payload) });
    }
    setIsSaving(false);
    setShowForm(false);
    void load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/talks/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    void load();
  }

  if (isLoading) return <p className="py-12 text-center text-gris">Chargement…</p>;

  const inputClass =
    "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

  return (
    <div className="bg-blanc rounded-xl shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-noir">Conférences ({talks.length})</h2>
        {!showForm && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
          >
            + Ajouter une conférence
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-gris/20 rounded-lg p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Titre (FR) *</span>
              <input value={form.titleFr} onChange={(e) => setForm({ ...form, titleFr: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Titre (EN) *</span>
              <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className={inputClass} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Description (FR)</span>
              <textarea value={form.descriptionFr} onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })} rows={3} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Description (EN)</span>
              <textarea value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} rows={3} className={inputClass} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Format *</span>
              <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as TalkFormat })} className={inputClass}>
                {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Niveau</span>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as "" | TalkLevel })} className={inputClass}>
                <option value="">Tous niveaux</option>
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Langue</span>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={inputClass}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Catégorie</span>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputClass}>
                <option value="">— Aucune —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nameFr}</option>)}
              </select>
            </label>
          </div>

          <div>
            <span className="block text-sm font-medium text-noir mb-1">Speakers</span>
            {speakers.length === 0 ? (
              <p className="text-sm text-gris">Aucun speaker disponible — créez-en dans l&apos;onglet Speakers.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {speakers.map((sp) => (
                  <label key={sp.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.speakerIds.includes(sp.id)}
                      onChange={() => toggleSpeaker(sp.id)}
                      className="rounded border-gris/30 text-malachite focus:ring-malachite"
                    />
                    <span className="text-sm text-noir">{sp.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.publicationStatus === "PUBLISHED"}
              onChange={(e) => setForm({ ...form, publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT" })}
              className="rounded border-gris/30 text-malachite focus:ring-malachite"
            />
            <span className="text-sm text-noir">Publié (visible sur le site)</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !form.titleFr.trim() || !form.titleEn.trim()}
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

      {/* Filters */}
      {talks.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)} className="rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-noir bg-blanc">
            <option value="">Tous formats</option>
            {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-noir bg-blanc">
            <option value="">Toutes catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nameFr}</option>)}
          </select>
          <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)} className="rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-noir bg-blanc">
            <option value="">Toutes langues</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-gris text-sm">
          {talks.length === 0 ? "Aucune conférence pour cette édition." : "Aucune conférence ne correspond aux filtres."}
        </p>
      ) : (
        <ul className="divide-y divide-gris/10">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-center gap-4 py-3">
              <span className="w-28 text-xs font-bold text-gris uppercase">{t.format}</span>
              <span className="flex-1 text-noir">
                {t.titleFr}
                {t.speakers.length > 0 && (
                  <span className="text-gris"> · {t.speakers.map((s) => s.name).join(", ")}</span>
                )}
              </span>
              {t.category && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${t.category.color}20`, color: t.category.color }}>
                  {t.category.nameFr}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  t.publicationStatus === "PUBLISHED" ? "bg-malachite/10 text-malachite" : "bg-gris/10 text-gris"
                }`}
              >
                {t.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
              </span>
              <button onClick={() => openEdit(t)} className="text-sm text-bleu hover:underline">Éditer</button>
              <button onClick={() => setDeleteTarget(t)} className="text-sm text-terre-cuite hover:underline">Supprimer</button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer cette conférence ?"
        message={`« ${deleteTarget?.titleFr} » sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
