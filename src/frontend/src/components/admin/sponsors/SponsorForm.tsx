"use client";

import { useState } from "react";

import type { AdminSponsorTier } from "@/lib/types";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import FilePickerDialog from "@/components/admin/FilePickerDialog";
import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";

export interface SponsorFormValue {
  name: string;
  tierId: number | null;
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
  tierId: null,
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
  tiers: AdminSponsorTier[];
}

// Which field a picker was opened for. One dialog serves several fields, so
// the open state has to name its target rather than be a bare boolean (#374).
type ImageTarget = "logoUrl" | "comKitLogoWebUrl" | "comKitLogoPrintUrl";

export default function SponsorForm({ value, onChange, tiers }: SponsorFormProps) {
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [isCharterPickerOpen, setIsCharterPickerOpen] = useState(false);

  // The promo-idea fields (#252) are gated on the selected tier, not on a
  // hard-coded Platinum level (#318).
  const selectedTier = tiers.find((t) => t.id === value.tierId);
  const allowsPromoIdeas = selectedTier?.allowsPromoIdeas ?? false;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Nom *</span>
          <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Niveau *</span>
          <select
            value={value.tierId ?? ""}
            onChange={(e) => onChange({ ...value, tierId: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          >
            <option value="" disabled>Choisir un niveau…</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.nameFr}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium text-noir mb-1">Logo</span>
        {/* Same guidance as the sponsor's own edit form (#340). Lives here
            rather than in ImagePickerDialog, which speakers and articles
            share. */}
        <p className="mb-2 text-xs text-gris">
          Logo en haute définition (largeur ≥ 1000 px), sans marge autour du logo. PNG ou WebP à
          fond transparent de préférence.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setImageTarget("logoUrl")}
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
        {/* Files, not free-form URLs (#374): these are assets the sponsor
            hands over, so they get the same picker + preview as the logo
            above. The charter is usually a PDF, hence the file picker. */}
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
        <label className="block mt-4">
          <span className="block text-sm font-medium text-noir mb-1">Notes / autres supports</span>
          <textarea value={value.comKitNotes} onChange={(e) => onChange({ ...value, comKitNotes: e.target.value })} rows={3} className={inputClass} />
        </label>

        {/* Promo ideas (#252) — shown only for tiers that allow them (#318). */}
        {allowsPromoIdeas && (
          <div className="mt-4 rounded-lg border border-jaune/40 bg-jaune/5 p-4">
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
      </fieldset>

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

// One com-kit asset: pick / preview / remove. Mirrors the logo block above,
// which stays inline because it carries its own sizing guidance (#340).
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
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-terre-cuite hover:underline"
            >
              Retirer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
