"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";

interface EditionData {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  aftermovieUrl: string | null;
  galleryUrl: string | null;
  archivedSiteUrl: string | null;
}

const STATUS_OPTIONS = [
  { value: "PREPARATION", label: "Preparation" },
  { value: "ANNOUNCEMENT", label: "Annonce" },
  { value: "SEE_YOU_NEXT_YEAR", label: "A l'annee prochaine" },
];

interface GeneralTabProps {
  edition: EditionData;
  onSaved: () => void;
}

export default function GeneralTab({ edition, onSaved }: GeneralTabProps) {
  const [form, setForm] = useState({
    status: edition.status,
    startDate: edition.startDate?.split("T")[0] || "",
    endDate: edition.endDate?.split("T")[0] || "",
    aftermovieUrl: edition.aftermovieUrl || "",
    galleryUrl: edition.galleryUrl || "",
    archivedSiteUrl: edition.archivedSiteUrl || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    await adminFetch(`/editions/${edition.id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        aftermovieUrl: form.aftermovieUrl || undefined,
        galleryUrl: form.galleryUrl || undefined,
        archivedSiteUrl: form.archivedSiteUrl || undefined,
      }),
    });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-noir mb-1">Statut</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Date debut" name="startDate" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
        <FormField label="Date fin" name="endDate" type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Aftermovie URL" name="aftermovieUrl" type="url" value={form.aftermovieUrl} onChange={(v) => setForm({ ...form, aftermovieUrl: v })} />
        <FormField label="Galerie URL" name="galleryUrl" type="url" value={form.galleryUrl} onChange={(v) => setForm({ ...form, galleryUrl: v })} />
        <FormField label="Site archive URL" name="archivedSiteUrl" type="url" value={form.archivedSiteUrl} onChange={(v) => setForm({ ...form, archivedSiteUrl: v })} />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        {saved && <span className="text-sm text-malachite">Sauvegarde !</span>}
      </div>
    </div>
  );
}
