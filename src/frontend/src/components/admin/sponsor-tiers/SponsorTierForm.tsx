"use client";

import BilingualInput from "@/components/admin/BilingualInput";
import FormField from "@/components/admin/FormField";

// The global catalogue offer form (#319). Every label is in French: the admin
// UI has no next-intl. Numeric fields are kept as strings in the form value and
// coerced on save, mirroring the other admin forms.
export interface SponsorTierFormValue {
  key: string;
  nameFr: string;
  nameEn: string;
  subtitleFr: string;
  subtitleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  advantages: { fr: string; en: string }[];
  standSize: string;
  color: string;
  logoScale: string;
  rank: string;
  jobOfferQuota: string;
  allowsPromoIdeas: boolean;
}

export const emptySponsorTierForm: SponsorTierFormValue = {
  key: "",
  nameFr: "",
  nameEn: "",
  subtitleFr: "",
  subtitleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  advantages: [],
  standSize: "",
  color: "#109E6E",
  logoScale: "1",
  rank: "0",
  jobOfferQuota: "1",
  allowsPromoIdeas: false,
};

const DEFAULT_COLORS = [
  { label: "Malachite", value: "#109E6E" },
  { label: "Jaune (Gold)", value: "#FFD428" },
  { label: "Rose (Discovery)", value: "#EE7CAD" },
  { label: "Bleu", value: "#507BBD" },
  { label: "Terre cuite", value: "#EC6839" },
  { label: "Émeraude", value: "#41B38E" },
];

interface SponsorTierFormProps {
  value: SponsorTierFormValue;
  onChange: (value: SponsorTierFormValue) => void;
  // The key is a technical identifier: editable on create, locked afterwards.
  isNew: boolean;
}

export default function SponsorTierForm({ value, onChange, isNew }: SponsorTierFormProps) {
  const logoScale = Number(value.logoScale) || 1;

  function addAdvantage() {
    onChange({ ...value, advantages: [...value.advantages, { fr: "", en: "" }] });
  }
  function updateAdvantage(index: number, lang: "fr" | "en", v: string) {
    const updated = [...value.advantages];
    updated[index] = { ...updated[index], [lang]: v };
    onChange({ ...value, advantages: updated });
  }
  function removeAdvantage(index: number) {
    onChange({ ...value, advantages: value.advantages.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Clé (identifiant technique)"
          name="key"
          value={value.key}
          onChange={(v) => onChange({ ...value, key: v })}
          required={isNew}
          disabled={!isNew}
          placeholder="platinum"
          helpText={isNew ? "Minuscules et tirets, unique. Non modifiable ensuite." : "Non modifiable."}
        />
        <FormField
          label="Taille du stand"
          name="standSize"
          value={value.standSize}
          onChange={(v) => onChange({ ...value, standSize: v })}
          placeholder="12m²"
        />
      </div>

      <BilingualInput
        label="Nom"
        nameFr="nameFr"
        nameEn="nameEn"
        valueFr={value.nameFr}
        valueEn={value.nameEn}
        onChangeFr={(v) => onChange({ ...value, nameFr: v })}
        onChangeEn={(v) => onChange({ ...value, nameEn: v })}
        required
      />

      <BilingualInput
        label="Sous-titre"
        nameFr="subtitleFr"
        nameEn="subtitleEn"
        valueFr={value.subtitleFr}
        valueEn={value.subtitleEn}
        onChangeFr={(v) => onChange({ ...value, subtitleFr: v })}
        onChangeEn={(v) => onChange({ ...value, subtitleEn: v })}
      />

      <BilingualInput
        label="Description"
        nameFr="descriptionFr"
        nameEn="descriptionEn"
        valueFr={value.descriptionFr}
        valueEn={value.descriptionEn}
        onChangeFr={(v) => onChange({ ...value, descriptionFr: v })}
        onChangeEn={(v) => onChange({ ...value, descriptionEn: v })}
        multiline
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          label="Rang (importance décroissante)"
          name="rank"
          type="number"
          value={value.rank}
          onChange={(v) => onChange({ ...value, rank: v })}
          min={0}
          helpText="Plus élevé = plus en avant."
        />
        <FormField
          label="Quota d'offres d'emploi"
          name="jobOfferQuota"
          type="number"
          value={value.jobOfferQuota}
          onChange={(v) => onChange({ ...value, jobOfferQuota: v })}
          min={0}
        />
        <FormField
          label="Taille du logo (échelle)"
          name="logoScale"
          type="number"
          value={value.logoScale}
          onChange={(v) => onChange({ ...value, logoScale: v })}
          min={0.1}
          max={2}
          step={0.1}
          helpText="1 = pleine taille, 0.5 = moitié."
        />
      </div>

      {/* logoScale preview: a reference box (scale 1) next to the offer's scale,
          so the admin can visualise the decreasing logo size between offers.
          The public wall does not consume logoScale yet (#321). */}
      <div>
        <span className="block text-sm font-medium text-noir mb-2">Aperçu de la taille du logo</span>
        <div className="flex items-end gap-6">
          <div className="text-center">
            <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-gris/40 bg-blanc-casse/50">
              <div className="rounded bg-gris/30" style={{ width: `${64}px`, height: `${24}px` }} />
            </div>
            <span className="mt-1 block text-xs text-gris">Référence (1.0)</span>
          </div>
          <div className="text-center">
            <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-gris/40 bg-blanc-casse/50">
              <div className="rounded" style={{ width: `${64 * logoScale}px`, height: `${24 * logoScale}px`, backgroundColor: value.color }} />
            </div>
            <span className="mt-1 block text-xs text-gris">Cette offre ({logoScale})</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-noir mb-1">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange({ ...value, color: c.value })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                value.color === c.value ? "border-noir scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
          <input
            type="color"
            value={value.color}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
            className="w-8 h-8 rounded-full cursor-pointer border-0"
            title="Couleur personnalisée"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.allowsPromoIdeas}
          onChange={(e) => onChange({ ...value, allowsPromoIdeas: e.target.checked })}
          className="rounded border-gris/30 text-malachite focus:ring-malachite"
        />
        <span className="text-sm text-noir">Autorise les idées promo réservées (contenu premium)</span>
      </label>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-noir">Avantages ({value.advantages.length})</label>
          <button type="button" onClick={addAdvantage} className="text-sm text-bleu hover:underline">
            + Ajouter
          </button>
        </div>
        {value.advantages.map((adv, i) => (
          <div key={i} className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-start">
            <label className="flex-1 block">
              <span className="mb-1 block text-xs text-gris sm:hidden">FR</span>
              <input
                type="text"
                placeholder="FR"
                value={adv.fr}
                onChange={(e) => updateAdvantage(i, "fr", e.target.value)}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </label>
            <label className="flex-1 block">
              <span className="mb-1 block text-xs text-gris sm:hidden">EN</span>
              <input
                type="text"
                placeholder="EN"
                value={adv.en}
                onChange={(e) => updateAdvantage(i, "en", e.target.value)}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </label>
            <button
              type="button"
              onClick={() => removeAdvantage(i)}
              className="text-terre-cuite hover:underline text-sm px-2 py-2 text-left sm:pt-2"
            >
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
