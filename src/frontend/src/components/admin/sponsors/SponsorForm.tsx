"use client";

import { useState } from "react";

import type { SponsorLevel } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";

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
  bluesky: string;
  locale: "fr" | "en";
  publicationStatus: "DRAFT" | "PUBLISHED";
  // Private fields (#249) — organizers only, never public.
  comKitReceived: boolean;
  comKitLogoWebUrl: string;
  comKitLogoPrintUrl: string;
  comKitCharterUrl: string;
  comKitNotes: string;
  platinumPromoIdea: string;
  platinumCoBuildIdea: string;
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
  bluesky: "",
  locale: "fr",
  publicationStatus: "DRAFT",
  comKitReceived: false,
  comKitLogoWebUrl: "",
  comKitLogoPrintUrl: "",
  comKitCharterUrl: "",
  comKitNotes: "",
  platinumPromoIdea: "",
  platinumCoBuildIdea: "",
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

      <BilingualTabs
        label="Description"
        // Rich text (#270) — strip tags before the empty check so <p></p> counts as empty.
        isEmpty={(lang) => !(lang === "fr" ? value.descriptionFr : value.descriptionEn).replace(/<[^>]*>/g, "").trim()}
        renderPanel={(lang) =>
          lang === "fr" ? (
            <RichTextEditor
              label=""
              name="sponsor-descriptionFr"
              value={value.descriptionFr}
              onChange={(html) => onChange({ ...value, descriptionFr: html })}
              showImageButton={false}
              minHeight="180px"
            />
          ) : (
            <RichTextEditor
              label=""
              name="sponsor-descriptionEn"
              value={value.descriptionEn}
              onChange={(html) => onChange({ ...value, descriptionEn: html })}
              showImageButton={false}
              minHeight="180px"
            />
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">LinkedIn</span>
          <input type="url" value={value.linkedin} onChange={(e) => onChange({ ...value, linkedin: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">X / Twitter</span>
          <input type="url" value={value.twitter} onChange={(e) => onChange({ ...value, twitter: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Bluesky</span>
          <input type="url" value={value.bluesky} onChange={(e) => onChange({ ...value, bluesky: e.target.value })} className={inputClass} />
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
          Langue des emails envoyés à ce sponsor et de sa page de modification.
        </span>
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

      {/* Private fields (#249) — organizers only, never shown publicly. The
          booth contacts are edited by the sponsor via their magic link; here we
          expose the com-kit tracking, which the orga fills in. */}
      <fieldset className="rounded-lg border-2 border-dashed border-gris/25 bg-blanc-casse/50 p-4">
        <legend className="px-2 text-sm font-semibold text-noir">🔒 Informations privées (kit de com)</legend>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={value.comKitReceived}
            onChange={(e) => onChange({ ...value, comKitReceived: e.target.checked })}
            className="rounded border-gris/30 text-malachite focus:ring-malachite"
          />
          <span className="text-sm text-noir">Kit de com reçu</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-noir mb-1">Logo (version Web)</span>
            <input type="url" value={value.comKitLogoWebUrl} onChange={(e) => onChange({ ...value, comKitLogoWebUrl: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-noir mb-1">Logo (version Print)</span>
            <input type="url" value={value.comKitLogoPrintUrl} onChange={(e) => onChange({ ...value, comKitLogoPrintUrl: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-noir mb-1">Charte graphique</span>
            <input type="url" value={value.comKitCharterUrl} onChange={(e) => onChange({ ...value, comKitCharterUrl: e.target.value })} className={inputClass} />
          </label>
        </div>
        <label className="block mt-4">
          <span className="block text-sm font-medium text-noir mb-1">Notes / autres supports</span>
          <textarea value={value.comKitNotes} onChange={(e) => onChange({ ...value, comKitNotes: e.target.value })} rows={3} className={inputClass} />
        </label>

        {/* Platinum-only ideas (#252) — shown only when level is Platinum. */}
        {value.level === "PLATINUM" && (
          <div className="mt-4 rounded-lg border border-jaune/40 bg-jaune/5 p-4">
            <p className="text-sm font-semibold text-noir mb-3">💎 Réservé aux partenaires Platinum</p>
            <label className="block">
              <span className="block text-sm font-medium text-noir mb-1">Contenu promotionnel à mettre en avant</span>
              <textarea value={value.platinumPromoIdea} onChange={(e) => onChange({ ...value, platinumPromoIdea: e.target.value })} rows={3} className={inputClass} />
            </label>
            <label className="block mt-4">
              <span className="block text-sm font-medium text-noir mb-1">Idées de contenu à co-construire</span>
              <textarea value={value.platinumCoBuildIdea} onChange={(e) => onChange({ ...value, platinumCoBuildIdea: e.target.value })} rows={3} className={inputClass} />
            </label>
          </div>
        )}
      </fieldset>

      <ImagePickerDialog
        open={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onSelect={(url) => onChange({ ...value, logoUrl: url })}
      />
    </div>
  );
}
