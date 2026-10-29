"use client";

import { useState } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// The badges' look (#639, #749): one background and one colour per type, the
// QR code's content, and which badge each dedicated-flow tier prints. The
// light zone and its layout are the same on every badge.

export type BadgeType = "PARTICIPANT" | "SPEAKER" | "VOLUNTEER" | "CONTRACTOR";

export interface BadgeDesign {
  qrContent: "TICKET" | "VCARD";
  types: Record<BadgeType, { background: string | null; color: string }>;
}

export interface OutsideTier {
  id: number;
  name: string;
  badgeType: BadgeType;
  isGuessed: boolean;
}

const TYPE_NAMES: Record<BadgeType, string> = {
  PARTICIPANT: "Participant",
  SPEAKER: "Speaker",
  VOLUNTEER: "Bénévole",
  CONTRACTOR: "Prestataire",
};

const TYPE_HELP: Record<BadgeType, string> = {
  PARTICIPANT: "Tous les tarifs des guichets, sponsors compris. Porte le numéro en haut à droite.",
  SPEAKER: "Sans numéro : accueil dédié.",
  VOLUNTEER: "Sans numéro : accueil dédié.",
  CONTRACTOR: "Sans numéro : accueil dédié.",
};

const TYPES = Object.keys(TYPE_NAMES) as BadgeType[];
const OUTSIDE_TYPES = TYPES.filter((t) => t !== "PARTICIPANT");

function BackgroundField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Fond du badge" className="h-16 w-12 object-cover rounded border border-gris/20" />
      ) : (
        <span className="h-16 w-12 rounded border border-dashed border-gris/40 text-[10px] text-gris flex items-center justify-center text-center">
          Fond 2026
        </span>
      )}
      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        className="px-3 py-1.5 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
      >
        {value ? "Changer" : "Choisir"}
      </button>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-sm text-terre-cuite hover:underline">
          Fond par défaut
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
  outsideTiers,
  onSaved,
}: {
  editionId: number;
  design: BadgeDesign;
  outsideTiers: OutsideTier[];
  onSaved: () => void;
}) {
  const [design, setDesign] = useState(initialDesign);
  const [tierTypes, setTierTypes] = useState(() => new Map(outsideTiers.map((t) => [t.id, t.badgeType])));
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
          Format A6. Un fond par type de badge (PNG, JPG, SVG ou PDF de la médiathèque, sans texte dans la zone
          claire) ; le prénom, le nom, l&apos;entreprise et le QR code s&apos;écrivent dans la couleur choisie.
        </p>
      </div>

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
            <BackgroundField value={design.types[type].background} onChange={(background) => setType(type, { background })} />
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

      {outsideTiers.length > 0 && (
        <div>
          <p className="text-sm font-medium text-noir mb-2">Badge des tarifs de l&apos;accueil dédié</p>
          <ul className="space-y-2">
            {outsideTiers.map((tier) => (
              <li key={tier.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-48 text-noir">{tier.name}</span>
                <select
                  value={tierTypes.get(tier.id)}
                  onChange={(e) => setTierTypes((m) => new Map(m).set(tier.id, e.target.value as BadgeType))}
                  className="px-3 py-1.5 rounded-lg border border-gris/30 text-noir"
                >
                  {OUTSIDE_TYPES.map((t) => (
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
