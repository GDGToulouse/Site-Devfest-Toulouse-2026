"use client";

import BilingualTabs from "@/components/admin/BilingualTabs";

const COLOR_PRESETS = ["#109E6E", "#EC6839", "#509EE3", "#F8AB06", "#EE7CAD", "#9A6CB8"];

export interface CategoryFormValue {
  nameFr: string;
  nameEn: string;
  color: string;
  // Editions proposing this track (#338). A category is global; this is what
  // binds it to a given year.
  editionIds: number[];
}

export const emptyCategoryForm: CategoryFormValue = {
  nameFr: "",
  nameEn: "",
  color: "#109E6E",
  editionIds: [],
};

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

interface CategoryFormProps {
  value: CategoryFormValue;
  onChange: (value: CategoryFormValue) => void;
  /** Editions offered for selection, newest first. */
  editions?: { id: number; year: number }[];
}

export default function CategoryForm({ value, onChange, editions = [] }: CategoryFormProps) {
  function toggleEdition(id: number) {
    const next = value.editionIds.includes(id)
      ? value.editionIds.filter((e) => e !== id)
      : [...value.editionIds, id];
    onChange({ ...value, editionIds: next });
  }

  return (
    <div className="space-y-4">
      <BilingualTabs
        label="Nom"
        required
        isEmpty={(lang) => !(lang === "fr" ? value.nameFr : value.nameEn).trim()}
        renderPanel={(lang) =>
          lang === "fr" ? (
            <input value={value.nameFr} onChange={(e) => onChange({ ...value, nameFr: e.target.value })} className={inputClass} />
          ) : (
            <input value={value.nameEn} onChange={(e) => onChange({ ...value, nameEn: e.target.value })} className={inputClass} />
          )
        }
      />

      <div>
        <span className="block text-sm font-medium text-noir mb-1">Couleur</span>
        <div className="flex items-center gap-3">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...value, color: c })}
              className={`h-8 w-8 rounded-full border-2 ${value.color === c ? "border-noir" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={value.color}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
            className="h-8 w-12 rounded border border-gris/30"
          />
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-noir mb-1">Éditions</span>
        <p className="mb-2 text-sm text-gris">
          Une catégorie est partagée : cochez les éditions qui la proposent.
        </p>
        {editions.length === 0 ? (
          <p className="text-sm text-gris">Aucune édition disponible.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {editions.map((edition) => {
              const isSelected = value.editionIds.includes(edition.id);
              return (
                <button
                  key={edition.id}
                  type="button"
                  onClick={() => toggleEdition(edition.id)}
                  aria-pressed={isSelected}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-bismarck text-blanc"
                      : "bg-blanc text-noir shadow-card hover:bg-blanc-casse"
                  }`}
                >
                  {edition.year}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
