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
  helpText?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
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
  helpText,
  disabled,
  multiline,
  rows = 3,
  min,
  max,
  step,
}: FormFieldProps) {
  const inputClass = [
    "w-full rounded-lg border px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 focus:border-malachite",
    error ? "border-terre-cuite" : "border-gris/30",
    disabled ? "bg-blanc-casse text-gris cursor-not-allowed" : "",
  ].join(" ");

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
          disabled={disabled}
          className={inputClass}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={inputClass}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
        />
      )}
      {error && <p id={`${name}-error`} className="mt-1 text-sm text-terre-cuite">{error}</p>}
      {helpText && !error && <p id={`${name}-help`} className="mt-1 text-xs text-gris">{helpText}</p>}
    </div>
  );
}
