"use client";

import type { TalkFormat, TalkLevel, Category, Speaker } from "@/lib/types";

const FORMATS: { value: TalkFormat; label: string }[] = [
  { value: "CONFERENCE", label: "Conférence (40 min)" },
  { value: "QUICKIE", label: "Quickie (15 min)" },
  { value: "KEYNOTE", label: "Keynote" },
  { value: "WORKSHOP", label: "Workshop" },
];
const LEVELS: { value: TalkLevel; label: string }[] = [
  { value: "DEBUTANT", label: "Débutant" },
  { value: "INTERMEDIAIRE", label: "Intermédiaire" },
  { value: "CONFIRME", label: "Confirmé" },
];

export interface TalkFormValue {
  title: string;
  description: string;
  format: TalkFormat;
  level: "" | TalkLevel;
  language: string;
  categoryId: string;
  speakerIds: number[];
  publicationStatus: "DRAFT" | "PUBLISHED";
  isSpeakerEditable: boolean;
}

export const emptyTalkForm: TalkFormValue = {
  title: "",
  description: "",
  format: "CONFERENCE",
  level: "",
  language: "fr",
  categoryId: "",
  speakerIds: [],
  publicationStatus: "DRAFT",
  isSpeakerEditable: false,
};

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

interface TalkFormProps {
  value: TalkFormValue;
  onChange: (value: TalkFormValue) => void;
  categories: Category[];
  speakers: Speaker[];
}

export default function TalkForm({ value, onChange, categories, speakers }: TalkFormProps) {
  function toggleSpeaker(id: number) {
    onChange({
      ...value,
      speakerIds: value.speakerIds.includes(id)
        ? value.speakerIds.filter((x) => x !== id)
        : [...value.speakerIds, id],
    });
  }

  return (
    <div className="space-y-4">
      {/* Single-language (#293): a talk is given in one language, picked below.
          No FR/EN tabs — translating a talk's own wording helps nobody. */}
      <label className="block">
        <span className="block text-sm font-medium text-noir mb-1">Titre *</span>
        <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} className={inputClass} />
        <span className="block text-xs text-gris mt-1">
          Dans la langue de la conférence (voir « Langue » ci-dessous).
        </span>
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-noir mb-1">Description</span>
        <textarea value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} rows={4} className={inputClass} />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Format *</span>
          <select value={value.format} onChange={(e) => onChange({ ...value, format: e.target.value as TalkFormat })} className={inputClass}>
            {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Niveau</span>
          <select value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as "" | TalkLevel })} className={inputClass}>
            <option value="">Tous niveaux</option>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Langue</span>
          <select value={value.language} onChange={(e) => onChange({ ...value, language: e.target.value })} className={inputClass}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-noir mb-1">Catégorie</span>
          <select value={value.categoryId} onChange={(e) => onChange({ ...value, categoryId: e.target.value })} className={inputClass}>
            <option value="">— Aucune —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nameFr}</option>)}
          </select>
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium text-noir mb-1">Speakers</span>
        {speakers.length === 0 ? (
          <p className="text-sm text-gris">Aucun speaker disponible pour cette édition.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {speakers.map((sp) => (
              <label key={sp.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.speakerIds.includes(sp.id)}
                  onChange={() => toggleSpeaker(sp.id)}
                  className="rounded border-gris/30 text-malachite focus:ring-malachite"
                />
                <span className="text-sm text-noir">{sp.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.publicationStatus === "PUBLISHED"}
          onChange={(e) => onChange({ ...value, publicationStatus: e.target.checked ? "PUBLISHED" : "DRAFT" })}
          className="rounded border-gris/30 text-malachite focus:ring-malachite"
        />
        <span className="text-sm text-noir">Publié (visible sur le site)</span>
      </label>

      {/* #289 — read-only by default; the flag has an effect the admin cannot
          see from here (it unlocks a form on the speaker's magic link page),
          hence the hint. */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.isSpeakerEditable}
            onChange={(e) => onChange({ ...value, isSpeakerEditable: e.target.checked })}
            className="rounded border-gris/30 text-malachite focus:ring-malachite"
          />
          <span className="text-sm text-noir">Édition autorisée par le speaker</span>
        </label>
        <span className="block text-xs text-gris mt-1">
          Le speaker pourra modifier le titre et la description depuis son lien de
          modification. Le format, le niveau et la langue restent réservés aux organisateurs.
        </span>
      </div>
    </div>
  );
}
