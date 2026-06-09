"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import type { Sponsor, SponsorLevel } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EditLinkActions from "@/components/admin/EditLinkActions";

const LEVELS: { value: SponsorLevel; label: string }[] = [
  { value: "PLATINUM", label: "Platinum" },
  { value: "GOLD", label: "Gold" },
  { value: "SILVER", label: "Silver" },
  { value: "SOUTIEN", label: "Soutien" },
  { value: "COMMUNAUTE", label: "Communauté" },
];

const emptyForm = {
  name: "",
  level: "PLATINUM" as SponsorLevel,
  logoUrl: "",
  websiteUrl: "",
  descriptionFr: "",
  descriptionEn: "",
  linkedin: "",
  twitter: "",
  publicationStatus: "DRAFT" as "DRAFT" | "PUBLISHED",
};

interface SponsorsTabProps {
  editionId: number;
}

export default function SponsorsTab({ editionId }: SponsorsTabProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [openLevels, setOpenLevels] = useState<SponsorLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sponsor | null>(null);
  const [levelsSaved, setLevelsSaved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [{ data: list }, { data: edition }] = await Promise.all([
      adminFetch<Sponsor[]>(`/sponsors?editionId=${editionId}`),
      adminFetch<{ openSponsorLevels: SponsorLevel[] }>(`/editions/${editionId}`),
    ]);
    if (list) setSponsors(list);
    if (edition) setOpenLevels(edition.openSponsorLevels ?? []);
    setIsLoading(false);
  }, [editionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(s: Sponsor) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      level: s.level,
      logoUrl: s.logoUrl || "",
      websiteUrl: s.websiteUrl || "",
      descriptionFr: s.descriptionFr || "",
      descriptionEn: s.descriptionEn || "",
      linkedin: s.socialLinks?.linkedin || "",
      twitter: s.socialLinks?.twitter || "",
      publicationStatus: s.publicationStatus,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setIsSaving(true);
    const socialLinks: Record<string, string> = {};
    if (form.linkedin.trim()) socialLinks.linkedin = form.linkedin.trim();
    if (form.twitter.trim()) socialLinks.twitter = form.twitter.trim();

    const payload = {
      editionId,
      name: form.name.trim(),
      level: form.level,
      logoUrl: form.logoUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      descriptionFr: form.descriptionFr || undefined,
      descriptionEn: form.descriptionEn || undefined,
      socialLinks,
      publicationStatus: form.publicationStatus,
    };

    if (editingId) {
      await adminFetch(`/sponsors/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await adminFetch("/sponsors", { method: "POST", body: JSON.stringify(payload) });
    }
    setIsSaving(false);
    setShowForm(false);
    void load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/sponsors/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    void load();
  }

  function toggleOpenLevel(level: SponsorLevel) {
    setOpenLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  }

  async function saveOpenLevels() {
    await adminFetch(`/editions/${editionId}`, {
      method: "PUT",
      body: JSON.stringify({ openSponsorLevels: openLevels }),
    });
    setLevelsSaved(true);
    setTimeout(() => setLevelsSaved(false), 3000);
  }

  if (isLoading) return <p className="py-12 text-center text-gris">Chargement…</p>;

  return (
    <div className="space-y-8">
      {/* US-245 — open sponsoring levels for this edition */}
      <div className="bg-blanc rounded-xl shadow-card p-6">
        <h2 className="text-lg font-bold text-noir mb-1">Niveaux de sponsoring ouverts</h2>
        <p className="text-sm text-gris mb-4">
          Seuls les niveaux cochés sont proposés à la création d&apos;un sponsor.
        </p>
        <div className="flex flex-wrap gap-3">
          {LEVELS.map((l) => (
            <label key={l.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={openLevels.includes(l.value)}
                onChange={() => toggleOpenLevel(l.value)}
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">{l.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveOpenLevels}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
          >
            Enregistrer les niveaux
          </button>
          {levelsSaved && <span className="text-sm text-malachite">Enregistré !</span>}
        </div>
      </div>

      {/* Sponsor list + form */}
      <div className="bg-blanc rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-noir">Sponsors ({sponsors.length})</h2>
          {!showForm && (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
            >
              + Ajouter un sponsor
            </button>
          )}
        </div>

        {showForm && (
          <div className="border border-gris/20 rounded-lg p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-noir mb-1">Nom *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-noir mb-1">Niveau *</span>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value as SponsorLevel })}
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                >
                  {LEVELS.filter((l) => openLevels.length === 0 || openLevels.includes(l.value)).map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="block text-sm font-medium text-noir mb-1">Logo</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsImagePickerOpen(true)}
                  className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
                >
                  {form.logoUrl ? "Changer le logo" : "Choisir un logo"}
                </button>
                {form.logoUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.logoUrl} alt="Logo" className="h-12 rounded object-contain" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logoUrl: "" })}
                      className="text-sm text-terre-cuite hover:underline"
                    >
                      Retirer
                    </button>
                  </>
                )}
              </div>
            </div>

            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Site web</span>
              <input
                type="url"
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-noir mb-1">Description (FR)</span>
                <textarea
                  value={form.descriptionFr}
                  onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-noir mb-1">Description (EN)</span>
                <textarea
                  value={form.descriptionEn}
                  onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-noir mb-1">LinkedIn</span>
                <input
                  type="url"
                  value={form.linkedin}
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-noir mb-1">X / Twitter</span>
                <input
                  type="url"
                  value={form.twitter}
                  onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publicationStatus === "PUBLISHED"}
                onChange={(e) =>
                  setForm({ ...form, publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT" })
                }
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">Publié (visible sur le site)</span>
            </label>

            {editingId !== null && (() => {
              const current = sponsors.find((s) => s.id === editingId);
              return current ? (
                <EditLinkActions
                  resource="sponsors"
                  entityId={editingId}
                  initialEmail={current.contactEmail ?? ""}
                  initialLocked={current.editLinkLocked}
                />
              ) : null;
            })()}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !form.name.trim()}
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

        {sponsors.length === 0 ? (
          <p className="py-8 text-center text-gris text-sm">Aucun sponsor pour cette édition.</p>
        ) : (
          <ul className="divide-y divide-gris/10">
            {sponsors.map((s) => (
              <li key={s.id} className="flex items-center gap-4 py-3">
                <span className="w-24 text-xs font-bold text-gris uppercase">{s.level}</span>
                <span className="flex-1 text-noir">{s.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    s.publicationStatus === "PUBLISHED"
                      ? "bg-malachite/10 text-malachite"
                      : "bg-gris/10 text-gris"
                  }`}
                >
                  {s.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
                </span>
                <button onClick={() => openEdit(s)} className="text-sm text-bleu hover:underline">
                  Éditer
                </button>
                <button
                  onClick={() => setDeleteTarget(s)}
                  className="text-sm text-terre-cuite hover:underline"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ImagePickerDialog
        open={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onSelect={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer ce sponsor ?"
        message={`« ${deleteTarget?.name} » sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
