"use client";

const COLOR_PRESETS = ["#109E6E", "#EC6839", "#509EE3", "#F8AB06", "#EE7CAD", "#9A6CB8"];

export interface CategoryFormValue {
  nameFr: string;
  nameEn: string;
  color: string;
  sortOrder: string;
}

export const emptyCategoryForm: CategoryFormValue = {
  nameFr: "",
  nameEn: "",
  color: "#109E6E",
  sortOrder: "0",
};

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

interface CategoryFormProps {
  value: CategoryFormValue;
  onChange: (value: CategoryFormValue) => void;
}

export default function CategoryForm({ value, onChange }: CategoryFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Nom (FR) *</span>
          <input value={value.nameFr} onChange={(e) => onChange({ ...value, nameFr: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Nom (EN) *</span>
          <input value={value.nameEn} onChange={(e) => onChange({ ...value, nameEn: e.target.value })} className={inputClass} />
        </label>
      </div>

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

      <label className="block max-w-[160px]">
        <span className="block text-sm font-medium text-noir mb-1">Ordre</span>
        <input
          type="number"
          value={value.sortOrder}
          onChange={(e) => onChange({ ...value, sortOrder: e.target.value })}
          className={inputClass}
        />
      </label>
    </div>
  );
}
