"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import FormField from "@/components/admin/FormField";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";

interface EditionData {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  venueName: string | null;
  venueAddress: string | null;
  heroImageUrl: string | null;
  cfpUrl: string | null;
  partnerFormUrl: string | null;
  aftermovieUrl: string | null;
  galleryUrl: string | null;
  archivedSiteUrl: string | null;
  sponsorBrochureUrl: string | null;
}

const STATUS_OPTIONS = [
  { value: "PREPARATION", label: "Préparation" },
  { value: "ANNOUNCEMENT", label: "Annonce" },
  { value: "SEE_YOU_NEXT_YEAR", label: "À l'année prochaine" },
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
    venueName: edition.venueName || "",
    venueAddress: edition.venueAddress || "",
    heroImageUrl: edition.heroImageUrl || "",
    partnerFormUrl: edition.partnerFormUrl || "",
    aftermovieUrl: edition.aftermovieUrl || "",
    galleryUrl: edition.galleryUrl || "",
    archivedSiteUrl: edition.archivedSiteUrl || "",
    sponsorBrochureUrl: edition.sponsorBrochureUrl || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isBrochurePickerOpen, setIsBrochurePickerOpen] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    await adminFetch(`/editions/${edition.id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        venueName: form.venueName || undefined,
        venueAddress: form.venueAddress || undefined,
        heroImageUrl: form.heroImageUrl || undefined,
        partnerFormUrl: form.partnerFormUrl || undefined,
        aftermovieUrl: form.aftermovieUrl || undefined,
        galleryUrl: form.galleryUrl || undefined,
        archivedSiteUrl: form.archivedSiteUrl || undefined,
        sponsorBrochureUrl: form.sponsorBrochureUrl || undefined,
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
        <FormField label="Date de début" name="startDate" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
        <FormField label="Date de fin" name="endDate" type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Nom du lieu" name="venueName" value={form.venueName} onChange={(v) => setForm({ ...form, venueName: v })} />
        <FormField label="Adresse / Ville" name="venueAddress" value={form.venueAddress} onChange={(v) => setForm({ ...form, venueAddress: v })} />
      </div>

      <div>
        <label className="block text-sm font-medium text-noir mb-1">Image hero</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsImagePickerOpen(true)}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
          >
            {form.heroImageUrl ? "Changer l'image" : "Choisir une image"}
          </button>
          {form.heroImageUrl && (
            <button
              type="button"
              onClick={() => setForm({ ...form, heroImageUrl: "" })}
              className="text-sm text-terre-cuite hover:underline"
            >
              Supprimer
            </button>
          )}
        </div>
        {form.heroImageUrl && (
          <div className="mt-2">
            <img src={form.heroImageUrl} alt="Hero preview" className="h-24 rounded-lg object-cover" />
            <p className="text-xs text-gris mt-1">{form.heroImageUrl}</p>
          </div>
        )}
        <ImagePickerDialog
          open={isImagePickerOpen}
          onClose={() => setIsImagePickerOpen(false)}
          onSelect={(url) => setForm({ ...form, heroImageUrl: url })}
        />
      </div>

      <FormField label="URL formulaire partenaire" name="partnerFormUrl" type="url" value={form.partnerFormUrl} onChange={(v) => setForm({ ...form, partnerFormUrl: v })} />

      {/* Sponsor brochure */}
      <div>
        <label className="block text-sm font-medium text-noir mb-1">Plaquette sponsors (PDF)</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsBrochurePickerOpen(true)}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
          >
            {form.sponsorBrochureUrl ? "Changer le fichier" : "Choisir un fichier"}
          </button>
          {form.sponsorBrochureUrl && (
            <button
              type="button"
              onClick={() => setForm({ ...form, sponsorBrochureUrl: "" })}
              className="text-sm text-terre-cuite hover:underline"
            >
              Supprimer
            </button>
          )}
        </div>
        {form.sponsorBrochureUrl && (
          <p className="text-xs text-gris mt-1">{form.sponsorBrochureUrl}</p>
        )}
        <ImagePickerDialog
          open={isBrochurePickerOpen}
          onClose={() => setIsBrochurePickerOpen(false)}
          onSelect={(url) => setForm({ ...form, sponsorBrochureUrl: url })}
        />
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
        {saved && <span className="text-sm text-malachite">Sauvegardé !</span>}
      </div>
    </div>
  );
}
