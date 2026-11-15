"use client";

import { useState } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// The badges' look (#639, #749, #774): per type a front background, a back
// background and a text colour; the QR code's colour and content; and which
// badge each tier prints. The layout is the same on every badge.

export type BadgeType = "PARTICIPANT" | "SPONSOR" | "STAFF" | "SPEAKER" | "VOLUNTEER" | "CONTRACTOR";

export interface BadgeDesign {
  qrContent: "TICKET" | "VCARD";
  qrColor: string;
  types: Record<BadgeType, { background: string | null; backBackground: string | null; color: string }>;
}

export interface TierBadge {
  id: number;
  name: string;
  isOutsideFlow: boolean;
  badgeType: BadgeType;
  isGuessed: boolean;
}

const TYPE_NAMES: Record<BadgeType, string> = {
  PARTICIPANT: "Participant",
  SPONSOR: "Sponsor",
  STAFF: "Staff",
  SPEAKER: "Speaker",
  VOLUNTEER: "Bénévole",
  CONTRACTOR: "Prestataire",
};

const COUNTER_HELP = "Passe par les guichets : porte un numéro en haut à droite.";
const OUTSIDE_HELP = "Sans numéro : accueil dédié.";
const TYPE_HELP: Record<BadgeType, string> = {
  PARTICIPANT: COUNTER_HELP,
  SPONSOR: COUNTER_HELP,
  STAFF: `Bénévoles présents toute l'année. ${OUTSIDE_HELP}`,
  SPEAKER: OUTSIDE_HELP,
  VOLUNTEER: OUTSIDE_HELP,
  CONTRACTOR: OUTSIDE_HELP,
};

const TYPES = Object.keys(TYPE_NAMES) as BadgeType[];
const COUNTER_TYPES: BadgeType[] = ["PARTICIPANT", "SPONSOR"];
const OUTSIDE_TYPES = TYPES.filter((t) => !COUNTER_TYPES.includes(t));

function BackgroundField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={`${label} du badge`} className="h-16 w-12 object-cover rounded border border-gris/20" />
      ) : (
        <span className="h-16 w-12 rounded border border-dashed border-gris/40 text-[10px] text-gris flex items-center justify-center text-center">
          Fond par défaut
        </span>
      )}
      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        className="px-3 py-1.5 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
      >
        {label} : {value ? "changer" : "choisir"}
      </button>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-sm text-terre-cuite hover:underline">
          Revenir au défaut
        </button>
      )}
      <ImagePickerDialog
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url) => {
          // The library may hand back an absolute address: the backend reads the file by its path.
          onChange(url.replace(/^https?:\/\/[^/]+/, ""));
          setIsPickerOpen(false);
        }}
      />
    </div>
  );
}

export default function BadgeDesignSection({
  editionId,
  design: initialDesign,
  tiers,
  onSaved,
}: {
  editionId: number;
  design: BadgeDesign;
  tiers: TierBadge[];
  onSaved: () => void;
}) {
  const [design, setDesign] = useState(initialDesign);
  const [tierTypes, setTierTypes] = useState(() => new Map(tiers.map((t) => [t.id, t.badgeType])));
  const [feedback, setFeedback] = useState<SaveState>(null);

  const setType = (type: BadgeType, patch: Partial<BadgeDesign["types"][BadgeType]>) =>
    setDesign((d) => ({ ...d, types: { ...d.types, [type]: { ...d.types[type], ...patch } } }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const result = await adminFetch(`/badges/${editionId}/design`, {
      method: "PUT",
      body: JSON.stringify({
        design,
        tierTypes: [...tierTypes].map(([tierId, badgeType]) => ({ tierId, badgeType })),
      }),
    });
    if (result.status === 200) {
      setFeedback({ kind: "ok", text: "Apparence des badges enregistrée." });
      onSaved();
    } else {
      setFeedback({ kind: "error", text: humanError(result, "L'apparence des badges n'a pas été enregistrée.") });
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-6 pt-6 border-t border-gris/20 space-y-4">
      <div>
        <h4 className="font-bold text-noir">Apparence des badges</h4>
        <p className="text-sm text-gris">
          Format A6, recto-verso. Un fond recto et un fond verso par type de badge (PNG, JPG, SVG ou PDF de la
          médiathèque, sans texte ni QR code d&apos;exemple) ; le prénom, le nom, l&apos;entreprise et le numéro
          s&apos;écrivent dans la couleur du type, le QR code dans sa propre couleur.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gris">
        Couleur du QR code
        <input
          type="color"
          value={design.qrColor}
          onChange={(e) => setDesign((d) => ({ ...d, qrColor: e.target.value.toUpperCase() }))}
          className="h-8 w-12 rounded border border-gris/30"
        />
        <span className="font-mono text-xs">{design.qrColor}</span>
      </label>

      <label className="block text-sm text-gris">
        Contenu du QR code
        <select
          value={design.qrContent}
          onChange={(e) => setDesign((d) => ({ ...d, qrContent: e.target.value as BadgeDesign["qrContent"] }))}
          className="block mt-1 px-3 py-2 rounded-lg border border-gris/30 text-sm text-noir"
        >
          <option value="TICKET">Code du billet (application de badges Billetweb des sponsors)</option>
          <option value="VCARD">Carte de contact (prénom, nom, entreprise)</option>
        </select>
      </label>

      <ul className="grid gap-3 md:grid-cols-2">
        {TYPES.map((type) => (
          <li key={type} className="border border-gris/20 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-noir">{TYPE_NAMES[type]}</p>
              <p className="text-xs text-gris">{TYPE_HELP[type]}</p>
            </div>
            <BackgroundField label="Recto" value={design.types[type].background} onChange={(background) => setType(type, { background })} />
            <BackgroundField
              label="Verso"
              value={design.types[type].backBackground}
              onChange={(backBackground) => setType(type, { backBackground })}
            />
            <label className="flex items-center gap-2 text-sm text-gris">
              Couleur du texte
              <input
                type="color"
                value={design.types[type].color}
                onChange={(e) => setType(type, { color: e.target.value.toUpperCase() })}
                className="h-8 w-12 rounded border border-gris/30"
              />
              <span className="font-mono text-xs">{design.types[type].color}</span>
            </label>
          </li>
        ))}
      </ul>

      {tiers.length > 0 && (
        <div>
          <p className="text-sm font-medium text-noir mb-2">Badge de chaque tarif</p>
          <ul className="space-y-2">
            {tiers.map((tier) => (
              <li key={tier.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-48 text-noir">
                  {tier.name}
                  <span className="block text-xs text-gris">{tier.isOutsideFlow ? "Accueil dédié" : "Guichets"}</span>
                </span>
                <select
                  value={tierTypes.get(tier.id)}
                  onChange={(e) => setTierTypes((m) => new Map(m).set(tier.id, e.target.value as BadgeType))}
                  className="px-3 py-1.5 rounded-lg border border-gris/30 text-noir"
                >
                  {(tier.isOutsideFlow ? OUTSIDE_TYPES : COUNTER_TYPES).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_NAMES[t]}
                    </option>
                  ))}
                </select>
                {tier.isGuessed && <span className="text-xs text-gris">déduit du nom du tarif, à confirmer</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg border border-gris/30 text-sm text-noir hover:bg-blanc-casse"
        >
          Enregistrer l&apos;apparence
        </button>
        <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
      </div>
    </form>
  );
}
