"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { STAT_ICONS, findStatIcon } from "@/lib/stat-icons";

interface StatIconFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}

// Icon picker for a key figure (#164). Replaces the free-text input: only
// catalogue keys can be chosen, and the current one is previewed so the editor
// sees what will actually show on the site — a mistyped key used to render
// nothing at all, with no warning anywhere.
export default function StatIconField({ label, name, value, onChange }: StatIconFieldProps) {
  const selected = findStatIcon(value);
  // A row saved before the catalogue existed may hold an unknown key. Surface
  // it rather than silently resetting the editor's data.
  const isUnknown = value !== "" && !selected;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-noir mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gris/30 bg-blanc-casse text-malachite"
        >
          {selected ? <FontAwesomeIcon icon={selected.icon} /> : <span className="text-xs text-gris">—</span>}
        </span>
        <select
          id={name}
          name={name}
          value={isUnknown ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "w-full rounded-lg border px-3 py-2 text-noir bg-blanc",
            "focus:outline-none focus:ring-2 focus:ring-malachite/50 focus:border-malachite",
            isUnknown ? "border-terre-cuite" : "border-gris/30",
          ].join(" ")}
        >
          <option value="">Aucune</option>
          {STAT_ICONS.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.labelFr}
            </option>
          ))}
        </select>
      </div>
      {isUnknown && (
        <p className="mt-1 text-xs text-terre-cuite">
          Icône inconnue («&nbsp;{value}&nbsp;») — elle ne s&apos;affiche pas sur le site. Choisissez-en une.
        </p>
      )}
    </div>
  );
}
