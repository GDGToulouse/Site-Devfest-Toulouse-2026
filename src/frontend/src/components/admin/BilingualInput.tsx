"use client";

import BilingualTabs from "./BilingualTabs";

interface BilingualInputProps {
  label: string;
  nameFr: string;
  nameEn: string;
  valueFr: string;
  valueEn: string;
  onChangeFr: (value: string) => void;
  onChangeEn: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}

// A bilingual text field. Same public API as before, now rendered as language
// tabs (#222) instead of two side-by-side columns, so each language uses the
// full width and a missing translation shows a dot on its tab.
export default function BilingualInput({
  label,
  nameFr,
  nameEn,
  valueFr,
  valueEn,
  onChangeFr,
  onChangeEn,
  required,
  multiline,
  rows = 3,
}: BilingualInputProps) {
  const inputClass =
    "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 focus:border-malachite";

  const fields = {
    fr: { name: nameFr, value: valueFr, onChange: onChangeFr },
    en: { name: nameEn, value: valueEn, onChange: onChangeEn },
  };

  return (
    <BilingualTabs
      label={label}
      required={required}
      isEmpty={(lang) => !fields[lang].value.trim()}
      renderPanel={(lang) => {
        const f = fields[lang];
        return multiline ? (
          <textarea id={f.name} name={f.name} value={f.value} onChange={(e) => f.onChange(e.target.value)} rows={rows} className={inputClass} />
        ) : (
          <input id={f.name} name={f.name} value={f.value} onChange={(e) => f.onChange(e.target.value)} className={inputClass} />
        );
      }}
    />
  );
}
