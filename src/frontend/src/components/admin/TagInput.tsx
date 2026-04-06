"use client";

import { useState, useRef, useEffect } from "react";
import { adminFetch } from "@/lib/admin-api";

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface TagInputProps {
  allTags: Tag[];
  selectedTagIds: number[];
  onChange: (tagIds: number[]) => void;
  onTagCreated: (tag: Tag) => void;
}

export default function TagInput({ allTags, selectedTagIds, onChange, onTagCreated }: TagInputProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
  const filtered = query.trim()
    ? allTags.filter((t) => !selectedTagIds.includes(t.id) && t.name.toLowerCase().includes(query.toLowerCase()))
    : allTags.filter((t) => !selectedTagIds.includes(t.id));
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectTag(tag: Tag) {
    onChange([...selectedTagIds, tag.id]);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function removeTag(tagId: number) {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  }

  async function createTag() {
    const name = query.trim();
    if (!name || exactMatch) return;
    setIsCreating(true);
    const { data, status } = await adminFetch<Tag>("/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setIsCreating(false);
    if (data && status === 201) {
      onTagCreated(data);
      onChange([...selectedTagIds, data.id]);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) {
        selectTag(filtered[0]);
      } else if (query.trim() && !exactMatch) {
        createTag();
      }
    }
    if (e.key === "Backspace" && !query && selectedTagIds.length > 0) {
      removeTag(selectedTagIds[selectedTagIds.length - 1]);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-noir mb-1">Tags</p>
      <div ref={containerRef} className="relative">
        <div className="flex flex-wrap gap-2 items-center rounded-lg border border-gris/30 px-3 py-2 bg-blanc focus-within:ring-2 focus-within:ring-malachite/50 focus-within:border-malachite">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm bg-malachite text-blanc"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="hover:text-blanc/70"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length === 0 ? "Ajouter un tag..." : ""}
            className="flex-1 min-w-[120px] outline-none text-sm text-noir bg-transparent"
          />
        </div>

        {isOpen && (filtered.length > 0 || (query.trim() && !exactMatch)) && (
          <div className="absolute z-10 mt-1 w-full bg-blanc rounded-lg border border-gris/20 shadow-card max-h-48 overflow-y-auto">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => selectTag(tag)}
                className="w-full text-left px-3 py-2 text-sm text-noir hover:bg-blanc-casse transition-colors"
              >
                {tag.name}
              </button>
            ))}
            {query.trim() && !exactMatch && (
              <button
                type="button"
                onClick={createTag}
                disabled={isCreating}
                className="w-full text-left px-3 py-2 text-sm text-malachite hover:bg-malachite/5 transition-colors border-t border-gris/10"
              >
                {isCreating ? "Creation..." : `Creer le tag "${query.trim()}"`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
