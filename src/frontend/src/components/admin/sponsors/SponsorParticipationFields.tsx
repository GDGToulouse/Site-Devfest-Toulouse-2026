"use client";

import { useState } from "react";

import type { AdminSponsorTier } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import PublicationSwitch from "@/components/admin/PublicationSwitch";

import { inputClass, removeButtonClass, type SponsorFormValue } from "./sponsor-form-shared";

interface SponsorParticipationFieldsProps {
  value: SponsorFormValue;
  onChange: (value: SponsorFormValue) => void;
  tiers: AdminSponsorTier[];
  // The year being edited. Shown on the fields whose scope it is, because the
  // whole point of the split is that "the logo" is never the company's logo.
  year: number | null;
  // The participation as stored, and the company's slug for the preview of a
  // draft (#632). Absent while the company is being created.
  savedStatus?: "DRAFT" | "PUBLISHED";
  sponsorSlug?: string;
}

// What this company bought for ONE edition (#393). These columns live on
// `EditionSponsor` and are frozen per year (#375): editing them here changes
// that edition alone, which the labels have to say out loud.
export default function SponsorParticipationFields({
  value,
  onChange,
  tiers,
  year,
  savedStatus,
  sponsorSlug,
}: SponsorParticipationFieldsProps) {
  const [isLogoPickerOpen, setIsLogoPickerOpen] = useState(false);

  const yearSuffix = year ? ` ${year}` : "";

  return (
    <div className="space-y-4">
      <label className="block md:max-w-sm">
        <span className="block text-sm font-medium text-noir mb-1">Niveau{yearSuffix} *</span>
        <select
          value={value.tierId ?? ""}
          onChange={(e) => onChange({ ...value, tierId: e.target.value ? Number(e.target.value) : null })}
          required
          aria-required="true"
          aria-invalid={value.tierId === null || undefined}
          className={inputClass}
        >
          <option value="" disabled>Choisir un niveau…</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.nameFr}</option>
          ))}
        </select>
        {value.tierId === null && (
          <span className="mt-1 block text-xs text-terre-cuite">
            Le niveau est obligatoire pour enregistrer.
          </span>
        )}
      </label>

      <div>
        <span className="block text-sm font-medium text-noir mb-1">Logo{yearSuffix}</span>
        {/* Same guidance as the sponsor's own edit form (#340). Lives here
            rather than in ImagePickerDialog, which speakers and articles
            share. */}
        <p className="mb-2 text-xs text-gris">
          Logo affiché sur cette édition uniquement : le remplacer ne touche pas aux années
          précédentes. Haute définition (largeur ≥ 1000 px), sans marge autour du logo.
          PNG ou WebP à fond transparent de préférence.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsLogoPickerOpen(true)}
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
                className={removeButtonClass}
              >
                Retirer
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-noir mb-1">Statut sur l&apos;édition{yearSuffix}</span>
        <PublicationSwitch
          label={`Statut de la participation${yearSuffix}`}
          value={value.publicationStatus}
          savedValue={savedStatus}
          unpublishMessage={`Retirer ${value.name || "ce sponsor"} du site pour${yearSuffix || " cette édition"} ? Il n'y sera plus visible après l'enregistrement.`}
          previewHref={sponsorSlug ? `/api/preview?type=sponsor&slug=${encodeURIComponent(sponsorSlug)}` : null}
          onChange={(publicationStatus) => onChange({ ...value, publicationStatus })}
        />
      </div>

      <ImagePickerDialog
        open={isLogoPickerOpen}
        onClose={() => setIsLogoPickerOpen(false)}
        onSelect={(url) => onChange({ ...value, logoUrl: url })}
      />
    </div>
  );
}
