"use client";

import {
  DIET_OPTIONS,
  EXPERIENCE_OPTIONS,
  GENDER_OPTIONS,
  type GuestDiet,
  type GuestDraft,
  type GuestExperience,
  type GuestGender,
} from "@/lib/sponsor-guests";

// One guest's fields (RG-INS-20), shared by the partner space and the
// back-office so both ask the same questions, in the Billetweb form's words.

const inputClass =
  "w-full rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50";

export default function GuestFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: GuestDraft;
  onChange: (draft: GuestDraft) => void;
  idPrefix: string;
}) {
  const set = <K extends keyof GuestDraft>(key: K, value: GuestDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-xs text-gris">Nom</span>
        <input value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="off" className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-gris">Prénom</span>
        <input value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="off" className={inputClass} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs text-gris">E-mail</span>
        <input
          type="email"
          value={draft.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="off"
          className={inputClass}
        />
      </label>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1 text-xs text-gris">Genre</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {GENDER_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-noir">
              <input
                type="radio"
                name={`${idPrefix}-gender`}
                checked={draft.gender === o.value}
                onChange={() => set("gender", o.value as GuestGender)}
                className="accent-malachite"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs text-gris">Expérience professionnelle</span>
        <select
          value={draft.experience}
          onChange={(e) => set("experience", e.target.value as GuestExperience)}
          className={inputClass}
        >
          <option value="" disabled>
            Choisir…
          </option>
          {EXPERIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-gris">Régime alimentaire</span>
        <select value={draft.diet} onChange={(e) => set("diet", e.target.value as GuestDiet)} className={inputClass}>
          {DIET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-2 text-sm text-noir sm:col-span-2">
        <input
          type="checkbox"
          checked={draft.attendsAfterParty}
          onChange={(e) => set("attendsAfterParty", e.target.checked)}
          className="mt-0.5 accent-malachite"
        />
        Participe à l&apos;after (à partir de 18h00)
      </label>
      <label className="flex items-start gap-2 text-sm text-noir sm:col-span-2">
        <input
          type="checkbox"
          checked={draft.needsAssistance}
          onChange={(e) => set("needsAssistance", e.target.checked)}
          className="mt-0.5 accent-malachite"
        />
        A besoin d&apos;une assistance particulière pendant l&apos;événement (précisée par mail)
      </label>
    </div>
  );
}
