"use client";

import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";

import { inputClass, type SponsorFormValue } from "./sponsor-form-shared";

interface SponsorIdentityFieldsProps {
  value: SponsorFormValue;
  onChange: (value: SponsorFormValue) => void;
}

// The company, independent of any year (#393). These columns live on `Sponsor`,
// so editing them changes what every edition shows — which is why they are kept
// apart from the participation fields rather than interleaved with them.
export default function SponsorIdentityFields({ value, onChange }: SponsorIdentityFieldsProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-noir mb-1">Nom *</span>
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          required
          aria-required="true"
          // Announced rather than only shown: the Save button below is disabled
          // while this is empty, and a disabled button explains nothing (#393).
          aria-invalid={!value.name.trim() || undefined}
          className={inputClass}
        />
        {!value.name.trim() && (
          <span className="mt-1 block text-xs text-terre-cuite">
            Le nom est obligatoire pour enregistrer.
          </span>
        )}
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-noir mb-1">Site web</span>
        <input
          type="url"
          value={value.websiteUrl}
          onChange={(e) => onChange({ ...value, websiteUrl: e.target.value })}
          className={inputClass}
        />
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
    </div>
  );
}
