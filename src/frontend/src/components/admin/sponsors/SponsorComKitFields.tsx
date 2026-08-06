"use client";

import { useState } from "react";

import type { AdminSponsorTier } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import FilePickerDialog from "@/components/admin/FilePickerDialog";

import { inputClass, removeButtonClass, type SponsorFormValue } from "./sponsor-form-shared";

interface SponsorComKitFieldsProps {
  value: SponsorFormValue;
  onChange: (value: SponsorFormValue) => void;
  tiers: AdminSponsorTier[];
  year: number | null;
}

// Which field a picker was opened for. One dialog serves several fields, so
// the open state has to name its target rather than be a bare boolean (#374).
type ImageTarget = "comKitLogoWebUrl" | "comKitLogoPrintUrl";

// Private assets the sponsor hands over (#249) — organizers only, never public.
// Per-edition like the rest of the participation, and voluminous enough that it
// used to bury the contacts below it (#393).
export default function SponsorComKitFields({ value, onChange, tiers, year }: SponsorComKitFieldsProps) {
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [isCharterPickerOpen, setIsCharterPickerOpen] = useState(false);

  // The promo-idea fields (#252) are gated on the selected tier, not on a
  // hard-coded Platinum level (#318).
  const selectedTier = tiers.find((t) => t.id === value.tierId);
  const allowsPromoIdeas = selectedTier?.allowsPromoIdeas ?? false;

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-blanc-casse px-3 py-2 text-sm text-gris-sur-creme">
        🔒 Informations privées, jamais publiées{year ? ` — édition ${year}` : ""}.
      </p>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.comKitReceived}
          onChange={(e) => onChange({ ...value, comKitReceived: e.target.checked })}
          className="rounded border-gris/30 text-malachite focus:ring-malachite"
        />
        <span className="text-sm text-noir">Kit de com reçu</span>
      </label>

      {/* Files, not free-form URLs (#374): these are assets the sponsor
          hands over, so they get the same picker + preview as the logo. The
          charter is usually a PDF, hence the file picker. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PickedAsset
          label="Logo (version Web)"
          url={value.comKitLogoWebUrl}
          preview="image"
          onPick={() => setImageTarget("comKitLogoWebUrl")}
          onClear={() => onChange({ ...value, comKitLogoWebUrl: "" })}
        />
        <PickedAsset
          label="Logo (version Print)"
          url={value.comKitLogoPrintUrl}
          preview="image"
          onPick={() => setImageTarget("comKitLogoPrintUrl")}
          onClear={() => onChange({ ...value, comKitLogoPrintUrl: "" })}
        />
        <PickedAsset
          label="Charte graphique"
          url={value.comKitCharterUrl}
          preview="file"
          onPick={() => setIsCharterPickerOpen(true)}
          onClear={() => onChange({ ...value, comKitCharterUrl: "" })}
        />
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-noir mb-1">Notes / autres supports</span>
        <textarea value={value.comKitNotes} onChange={(e) => onChange({ ...value, comKitNotes: e.target.value })} rows={3} className={inputClass} />
      </label>

      {/* Promo ideas (#252) — shown only for tiers that allow them (#318). */}
      {allowsPromoIdeas && (
        <div className="rounded-lg border border-jaune/40 bg-jaune/5 p-4">
          <p className="text-sm font-semibold text-noir mb-3">💎 Réservé aux partenaires premium</p>
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

      <ImagePickerDialog
        open={imageTarget !== null}
        onClose={() => setImageTarget(null)}
        onSelect={(url) => {
          if (imageTarget) onChange({ ...value, [imageTarget]: url });
        }}
      />

      <FilePickerDialog
        open={isCharterPickerOpen}
        onClose={() => setIsCharterPickerOpen(false)}
        onSelect={(url) => onChange({ ...value, comKitCharterUrl: url })}
      />
    </div>
  );
}

// One com-kit asset: pick / preview / remove.
function PickedAsset({
  label,
  url,
  preview,
  onPick,
  onClear,
}: {
  label: string;
  url: string;
  preview: "image" | "file";
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="block">
      <span className="block text-sm font-medium text-noir mb-1">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPick}
          className="px-3 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
        >
          {url ? "Changer" : "Choisir un fichier"}
        </button>
        {url && (
          <>
            {preview === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={label} className="h-10 rounded object-contain" />
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-bleu hover:underline truncate max-w-[12rem]"
              >
                {url.split("/").pop()}
              </a>
            )}
            <button type="button" onClick={onClear} className={removeButtonClass}>
              Retirer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
