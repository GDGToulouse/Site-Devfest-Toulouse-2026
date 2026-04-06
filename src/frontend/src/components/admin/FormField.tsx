"use client";

interface FormFieldProps {
  label: string;
  name: string;
  type?: "text" | "email" | "url" | "number" | "date" | "datetime-local";
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
}

export default function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  required,
  placeholder,
  error,
  multiline,
  rows = 3,
}: FormFieldProps) {
  const inputClass =
    "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 focus:border-malachite";

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-noir mb-1">
        {label}
        {required && <span className="text-terre-cuite ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={inputClass}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      {error && <p className="mt-1 text-sm text-terre-cuite">{error}</p>}
    </div>
  );
}
