"use client";

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

  return (
    <div>
      <p className="text-sm font-medium text-noir mb-2">
        {label}
        {required && <span className="text-terre-cuite ml-1">*</span>}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor={nameFr} className="block text-xs text-gris mb-1">
            Francais
          </label>
          {multiline ? (
            <textarea
              id={nameFr}
              name={nameFr}
              value={valueFr}
              onChange={(e) => onChangeFr(e.target.value)}
              rows={rows}
              className={inputClass}
            />
          ) : (
            <input
              id={nameFr}
              name={nameFr}
              value={valueFr}
              onChange={(e) => onChangeFr(e.target.value)}
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label htmlFor={nameEn} className="block text-xs text-gris mb-1">
            English
          </label>
          {multiline ? (
            <textarea
              id={nameEn}
              name={nameEn}
              value={valueEn}
              onChange={(e) => onChangeEn(e.target.value)}
              rows={rows}
              className={inputClass}
            />
          ) : (
            <input
              id={nameEn}
              name={nameEn}
              value={valueEn}
              onChange={(e) => onChangeEn(e.target.value)}
              className={inputClass}
            />
          )}
        </div>
      </div>
    </div>
  );
}
