"use client";

import { useState } from "react";

import type { Sponsor } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import BilingualTabs from "@/components/admin/BilingualTabs";

export interface SpeakerFormValue {
  name: string;
  photoUrl: string;
  company: string;
  city: string;
  bioFr: string;
  bioEn: string;
  linkedin: string;
  twitter: string;
  bluesky: string;
  github: string;
  website: string;
  locale: "fr" | "en";
  isFeatured: boolean;
  sponsorId: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
}

export const emptySpeakerForm: SpeakerFormValue = {
  name: "",
  photoUrl: "",
  company: "",
  city: "",
  bioFr: "",
  bioEn: "",
  linkedin: "",
  twitter: "",
  bluesky: "",
  github: "",
  website: "",
  locale: "fr",
  isFeatured: false,
  sponsorId: "",
  publicationStatus: "DRAFT",
};

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

interface SpeakerFormProps {
  value: SpeakerFormValue;
  onChange: (value: SpeakerFormValue) => void;
  sponsors: Sponsor[];
}

export default function SpeakerForm({ value, onChange, sponsors }: SpeakerFormProps) {
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Nom *</span>
          <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Entreprise</span>
          <input value={value.company} onChange={(e) => onChange({ ...value, company: e.target.value })} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Ville</span>
          <input value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Sponsor associé</span>
          <select value={value.sponsorId} onChange={(e) => onChange({ ...value, sponsorId: e.target.value })} className={inputClass}>
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
            {value.photoUrl ? "Changer la photo" : "Choisir une photo"}
          </button>
          {value.photoUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.photoUrl} alt="Photo" className="h-12 w-12 rounded-full object-cover" />
              <button
                type="button"
                onClick={() => onChange({ ...value, photoUrl: "" })}
                className="text-sm text-terre-cuite hover:underline"
              >
                Retirer
              </button>
            </>
          )}
        </div>
      </div>

      <BilingualTabs
        label="Bio"
        isEmpty={(lang) => !(lang === "fr" ? value.bioFr : value.bioEn).trim()}
        renderPanel={(lang) =>
          lang === "fr" ? (
            <textarea value={value.bioFr} onChange={(e) => onChange({ ...value, bioFr: e.target.value })} rows={4} className={inputClass} />
          ) : (
            <textarea value={value.bioEn} onChange={(e) => onChange({ ...value, bioEn: e.target.value })} rows={4} className={inputClass} />
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">LinkedIn</span>
          <input type="url" value={value.linkedin} onChange={(e) => onChange({ ...value, linkedin: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">GitHub</span>
          <input type="url" value={value.github} onChange={(e) => onChange({ ...value, github: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">X / Twitter</span>
          <input type="url" value={value.twitter} onChange={(e) => onChange({ ...value, twitter: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Bluesky</span>
          <input type="url" value={value.bluesky} onChange={(e) => onChange({ ...value, bluesky: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Site web</span>
          <input type="url" value={value.website} onChange={(e) => onChange({ ...value, website: e.target.value })} className={inputClass} />
        </label>
      </div>

      <label className="block max-w-xs">
        <span className="block text-sm font-medium text-noir mb-1">Langue de contact</span>
        <select
          value={value.locale}
          onChange={(e) => onChange({ ...value, locale: e.target.value as "fr" | "en" })}
          className={inputClass}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
        <span className="block text-xs text-gris mt-1">
          Langue des emails envoyés à ce speaker et de sa page de modification.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.isFeatured}
            onChange={(e) => onChange({ ...value, isFeatured: e.target.checked })}
            className="rounded border-gris/30 text-malachite focus:ring-malachite"
          />
          <span className="text-sm text-noir">En vedette (page d&apos;accueil)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.publicationStatus === "PUBLISHED"}
            onChange={(e) => onChange({ ...value, publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT" })}
            className="rounded border-gris/30 text-malachite focus:ring-malachite"
          />
          <span className="text-sm text-noir">Publié (visible sur le site)</span>
        </label>
      </div>

      <ImagePickerDialog
        open={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onSelect={(url) => onChange({ ...value, photoUrl: url })}
      />
    </div>
  );
}
