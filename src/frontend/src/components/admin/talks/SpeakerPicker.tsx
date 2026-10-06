"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";

interface SpeakerOption {
  id: number;
  name: string;
  company?: string | null;
}

interface SpeakerPickerProps {
  speakers: SpeakerOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

// French collation: "Éric" among the E, not after the Z.
const collator = new Intl.Collator("fr", { sensitivity: "base" });

// Accent- and case-insensitive: typing "eric" finds "Éric".
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// A talk's speakers as chips picked from a searchable list (#508), replacing a
// checkbox per speaker of the year — 50 to 64 of them. Built on TagInput's
// layout, with the ARIA combobox pattern: arrow keys move through the options,
// Enter picks, Backspace on an empty field drops the last chip.
//
// Chips are sorted by name: the relation stores no order and the site lists
// speakers by name, so showing the input order would be undone on reload.
// No creation from here: a speaker must first be attached to the edition.
export default function SpeakerPicker({ speakers, selectedIds, onChange }: SpeakerPickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labelId = useId();

  const sorted = useMemo(() => [...speakers].sort((a, b) => collator.compare(a.name, b.name)), [speakers]);
  const selected = sorted.filter((s) => selectedIds.includes(s.id));
  const options = useMemo(() => {
    const q = fold(query.trim());
    return sorted.filter(
      (s) => !selectedIds.includes(s.id) && (!q || fold(s.name).includes(q) || fold(s.company ?? "").includes(q)),
    );
  }, [sorted, selectedIds, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(speaker: SpeakerOption) {
    onChange([...selectedIds, speaker.id]);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function remove(id: number) {
    onChange(selectedIds.filter((s) => s !== id));
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Never submits the talk form from inside the picker.
      e.preventDefault();
      const target = options[activeIndex] ?? (query.trim() ? options[0] : undefined);
      if (isOpen && target) pick(target);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      remove(selected[selected.length - 1].id);
    }
  }

  const showList = isOpen && (options.length > 0 || query.trim() !== "");
  const activeId = activeIndex >= 0 && options[activeIndex] ? `${listboxId}-${options[activeIndex].id}` : undefined;

  return (
    <div>
      <span id={labelId} className="block text-sm font-medium text-noir mb-1">Speakers</span>
      <div ref={containerRef} className="relative">
        <div className="flex flex-wrap gap-2 items-center rounded-lg border border-gris/30 px-3 py-2 bg-blanc focus-within:ring-2 focus-within:ring-malachite/50 focus-within:border-malachite">
          {selected.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm bg-malachite text-blanc">
              {s.name}
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`Retirer ${s.name}`}
                className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full hover:text-blanc/70 focus-visible:outline-2 focus-visible:outline-blanc"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-labelledby={labelId}
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selected.length === 0 ? "Rechercher un speaker de l'édition…" : ""}
            className="flex-1 min-w-[160px] outline-none text-sm text-noir bg-transparent"
          />
        </div>

        {showList && (
          <div className="absolute z-10 mt-1 w-full bg-blanc rounded-lg border border-gris/20 shadow-card max-h-56 overflow-y-auto">
            {options.length > 0 ? (
              <ul id={listboxId} role="listbox" aria-labelledby={labelId}>
                {options.map((s, i) => (
                  <li
                    key={s.id}
                    id={`${listboxId}-${s.id}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    // mousedown, not click: picking must happen before the
                    // input's blur closes the list.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(s);
                    }}
                    className={`cursor-pointer px-3 py-2 text-sm text-noir ${i === activeIndex ? "bg-blanc-casse" : "hover:bg-blanc-casse"}`}
                  >
                    {s.name}
                    {s.company ? <span className="text-gris"> — {s.company}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p id={listboxId} className="px-3 py-2 text-sm text-gris">
                Aucun speaker trouvé. Rattachez-le d&apos;abord à l&apos;édition depuis la{" "}
                <Link href="/admin/speakers" className="text-bleu underline">liste des speakers</Link>.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
