"use client";

import { useEffect, useId, useState } from "react";

// Finding a file in the library by text (#768), shared by the Fichiers page and
// both pickers. The name and what uses the file (a sponsor, a speaker: the line
// under the thumbnail) are always searched; the alt text and the tags' names
// only when ticked, since a word in an alt text would otherwise flood a search
// meant for a file.

export interface FileSearchValue {
  text: string;
  alt: boolean;
  tags: boolean;
}

export const EMPTY_FILE_SEARCH: FileSearchValue = { text: "", alt: false, tags: false };

const SEARCH_DELAY_MS = 300;
// The backend refuses longer (routes/admin/files.ts).
const SEARCH_MAX_LENGTH = 100;
// What the API searches when `in` is left out.
const DEFAULT_FIELDS = ["name", "usages"];

/** The `q` and `in` query parameters of `GET /api/admin/files`, empty when there is no search. */
export function fileSearchParams(value: FileSearchValue): Record<string, string> {
  const text = value.text.trim();
  if (!text) return {};
  if (!value.alt && !value.tags) return { q: text };
  const fields = [...DEFAULT_FIELDS, ...(value.alt ? ["alt"] : []), ...(value.tags ? ["tags"] : [])];
  return { q: text, in: fields.join(",") };
}

/** The reverse of fileSearchParams, for a page that keeps its search in the URL. */
export function parseFileSearch(q: string, fields: string): FileSearchValue {
  const list = fields.split(",");
  return { text: q, alt: list.includes("alt"), tags: list.includes("tags") };
}

interface FileSearchProps {
  value: FileSearchValue;
  onChange: (value: FileSearchValue) => void;
}

export default function FileSearch({ value, onChange }: FileSearchProps) {
  const id = useId();
  // Typed text waits for a pause before it searches: one request per word, not
  // per letter. The boxes apply at once.
  const [input, setInput] = useState(value.text);

  // A reset from outside (another filter, the back button) shows in the field,
  // without trimming what is being typed.
  useEffect(() => {
    setInput((current) => (current.trim() === value.text ? current : value.text));
  }, [value.text]);

  useEffect(() => {
    if (input.trim() === value.text) return;
    const timer = setTimeout(() => onChange({ ...value, text: input.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input, value, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <input
        type="search"
        aria-label="Rechercher un fichier"
        value={input}
        maxLength={SEARCH_MAX_LENGTH}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Nom du fichier, sponsor, speaker…"
        className="w-64 max-w-full rounded-lg border border-gris/30 bg-blanc px-3 py-1.5 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
      />
      <span className="flex items-center gap-4 text-sm text-noir">
        <span className="text-gris">Chercher aussi dans :</span>
        <label htmlFor={`${id}-alt`} className="flex items-center gap-1.5">
          <input
            id={`${id}-alt`}
            type="checkbox"
            checked={value.alt}
            onChange={(e) => onChange({ ...value, text: input.trim(), alt: e.target.checked })}
          />
          Texte alternatif
        </label>
        <label htmlFor={`${id}-tags`} className="flex items-center gap-1.5">
          <input
            id={`${id}-tags`}
            type="checkbox"
            checked={value.tags}
            onChange={(e) => onChange({ ...value, text: input.trim(), tags: e.target.checked })}
          />
          Tags
        </label>
      </span>
    </div>
  );
}
