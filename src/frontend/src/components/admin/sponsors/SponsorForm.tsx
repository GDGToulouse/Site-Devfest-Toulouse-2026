"use client";

import { useState } from "react";

import type { SponsorLevel } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";

const LEVELS: { value: SponsorLevel; label: string }[] = [
  { value: "PLATINUM", label: "Platinum" },
  { value: "GOLD", label: "Gold" },
  { value: "SILVER", label: "Silver" },
  { value: "SOUTIEN", label: "Soutien" },
  { value: "COMMUNAUTE", label: "Communauté" },
];

export interface SponsorFormValue {
  name: string;
  level: SponsorLevel;
  logoUrl: string;
  websiteUrl: string;
  descriptionFr: string;
  descriptionEn: string;
  linkedin: string;
  twitter: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
}

export const emptySponsorForm: SponsorFormValue = {
  name: "",
  level: "PLATINUM",
  logoUrl: "",
  websiteUrl: "",
  descriptionFr: "",
  descriptionEn: "",
  linkedin: "",
  twitter: "",
  publicationStatus: "DRAFT",
};

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

interface SponsorFormProps {
  value: SponsorFormValue;
  onChange: (value: SponsorFormValue) => void;
}

export default function SponsorForm({ value, onChange }: SponsorFormProps) {
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Nom *</span>
          <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Niveau *</span>
          <select value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as SponsorLevel })} className={inputClass}>
            {LEVELS.map((l) => (
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
            {value.logoUrl ? "Changer le logo" : "Choisir un logo"}
          </button>
          {value.logoUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.logoUrl} alt="Logo" className="h-12 rounded object-contain" />
              <button
                type="button"
                onClick={() => onChange({ ...value, logoUrl: "" })}
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
        <input type="url" value={value.websiteUrl} onChange={(e) => onChange({ ...value, websiteUrl: e.target.value })} className={inputClass} />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Description (FR)</span>
          <textarea value={value.descriptionFr} onChange={(e) => onChange({ ...value, descriptionFr: e.target.value })} rows={3} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Description (EN)</span>
          <textarea value={value.descriptionEn} onChange={(e) => onChange({ ...value, descriptionEn: e.target.value })} rows={3} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">LinkedIn</span>
          <input type="url" value={value.linkedin} onChange={(e) => onChange({ ...value, linkedin: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">X / Twitter</span>
          <input type="url" value={value.twitter} onChange={(e) => onChange({ ...value, twitter: e.target.value })} className={inputClass} />
        </label>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.publicationStatus === "PUBLISHED"}
          onChange={(e) => onChange({ ...value, publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT" })}
          className="rounded border-gris/30 text-malachite focus:ring-malachite"
        />
        <span className="text-sm text-noir">Publié (visible sur le site)</span>
      </label>

      <ImagePickerDialog
        open={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onSelect={(url) => onChange({ ...value, logoUrl: url })}
      />
    </div>
  );
}
