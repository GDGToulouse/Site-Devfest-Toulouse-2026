"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import type { Speaker, Sponsor } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EditLinkActions from "@/components/admin/EditLinkActions";

const emptyForm = {
  name: "",
  photoUrl: "",
  company: "",
  city: "",
  bioFr: "",
  bioEn: "",
  linkedin: "",
  twitter: "",
  github: "",
  website: "",
  isFeatured: false,
  sponsorId: "" as string,
  publicationStatus: "DRAFT" as "DRAFT" | "PUBLISHED",
};

interface SpeakersTabProps {
  editionId: number;
}

export default function SpeakersTab({ editionId }: SpeakersTabProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Speaker | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [{ data: list }, { data: spList }] = await Promise.all([
      adminFetch<Speaker[]>(`/speakers?editionId=${editionId}`),
      adminFetch<Sponsor[]>(`/sponsors?editionId=${editionId}`),
    ]);
    if (list) setSpeakers(list);
    if (spList) setSponsors(spList);
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

  function openEdit(s: Speaker) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      photoUrl: s.photoUrl || "",
      company: s.company || "",
      city: s.city || "",
      bioFr: s.bioFr || "",
      bioEn: s.bioEn || "",
      linkedin: s.socialLinks?.linkedin || "",
      twitter: s.socialLinks?.twitter || "",
      github: s.socialLinks?.github || "",
      website: s.socialLinks?.website || "",
      isFeatured: s.isFeatured,
      sponsorId: s.sponsorId ? String(s.sponsorId) : "",
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
    if (form.github.trim()) socialLinks.github = form.github.trim();
    if (form.website.trim()) socialLinks.website = form.website.trim();

    const payload = {
      editionId,
      name: form.name.trim(),
      photoUrl: form.photoUrl || undefined,
      company: form.company || undefined,
      city: form.city || undefined,
      bioFr: form.bioFr || undefined,
      bioEn: form.bioEn || undefined,
      socialLinks,
      isFeatured: form.isFeatured,
      sponsorId: form.sponsorId ? Number(form.sponsorId) : null,
      publicationStatus: form.publicationStatus,
    };

    if (editingId) {
      await adminFetch(`/speakers/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await adminFetch("/speakers", { method: "POST", body: JSON.stringify(payload) });
    }
    setIsSaving(false);
    setShowForm(false);
    void load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/speakers/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    void load();
  }

  function socialCardUrl(s: Speaker) {
    return `/speakers/${s.slug}/social-card`;
  }

  function openSocialCard(s: Speaker) {
    window.open(socialCardUrl(s), "_blank", "noopener");
  }

  function openAllSocialCards() {
    const published = speakers.filter((s) => s.publicationStatus === "PUBLISHED");
    for (const s of published) {
      window.open(socialCardUrl(s), "_blank", "noopener");
    }
  }

  if (isLoading) return <p className="py-12 text-center text-gris">Chargement…</p>;

  const publishedCount = speakers.filter((s) => s.publicationStatus === "PUBLISHED").length;

  const inputClass =
    "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-noir">Speakers ({speakers.length})</h2>
        {!showForm && (
          <div className="flex items-center gap-3">
            {publishedCount > 0 && (
              <button
                onClick={openAllSocialCards}
                title="Ouvre le visuel de chaque speaker publié dans un nouvel onglet"
                className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
              >
                Générer les visuels ({publishedCount})
              </button>
            )}
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
            >
              + Ajouter un speaker
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="border border-gris/20 rounded-lg p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Nom *</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Entreprise</span>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputClass} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Ville</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Sponsor associé</span>
              <select
                value={form.sponsorId}
                onChange={(e) => setForm({ ...form, sponsorId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Aucun —</option>
                {sponsors.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="block text-sm font-medium text-noir mb-1">Photo</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsImagePickerOpen(true)}
                className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
              >
                {form.photoUrl ? "Changer la photo" : "Choisir une photo"}
              </button>
              {form.photoUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.photoUrl} alt="Photo" className="h-12 w-12 rounded-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, photoUrl: "" })}
                    className="text-sm text-terre-cuite hover:underline"
                  >
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Bio (FR)</span>
              <textarea value={form.bioFr} onChange={(e) => setForm({ ...form, bioFr: e.target.value })} rows={3} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Bio (EN)</span>
              <textarea value={form.bioEn} onChange={(e) => setForm({ ...form, bioEn: e.target.value })} rows={3} className={inputClass} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">LinkedIn</span>
              <input type="url" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">GitHub</span>
              <input type="url" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">X / Twitter</span>
              <input type="url" value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Site web</span>
              <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">En vedette (page d&apos;accueil)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publicationStatus === "PUBLISHED"}
                onChange={(e) => setForm({ ...form, publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT" })}
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">Publié (visible sur le site)</span>
            </label>
          </div>

          {editingId !== null && (() => {
            const current = speakers.find((s) => s.id === editingId);
            return current ? (
              <EditLinkActions
                resource="speakers"
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

      {speakers.length === 0 ? (
        <p className="py-8 text-center text-gris text-sm">Aucun speaker pour cette édition.</p>
      ) : (
        <ul className="divide-y divide-gris/10">
          {speakers.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-3">
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt={s.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blanc-casse text-sm font-bold text-gris">
                  {s.name.charAt(0)}
                </span>
              )}
              <span className="flex-1 text-noir">
                {s.name}
                {s.company && <span className="text-gris"> · {s.company}</span>}
              </span>
              {s.isFeatured && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-terre-cuite/10 text-terre-cuite">Vedette</span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  s.publicationStatus === "PUBLISHED" ? "bg-malachite/10 text-malachite" : "bg-gris/10 text-gris"
                }`}
              >
                {s.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
              </span>
              {s.publicationStatus === "PUBLISHED" && (
                <button onClick={() => openSocialCard(s)} className="text-sm text-malachite hover:underline">Visuel</button>
              )}
              <button onClick={() => openEdit(s)} className="text-sm text-bleu hover:underline">Éditer</button>
              <button onClick={() => setDeleteTarget(s)} className="text-sm text-terre-cuite hover:underline">Supprimer</button>
            </li>
          ))}
        </ul>
      )}

      <ImagePickerDialog
        open={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onSelect={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer ce speaker ?"
        message={`« ${deleteTarget?.name} » sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
