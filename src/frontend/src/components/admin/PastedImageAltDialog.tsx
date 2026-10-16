"use client";

import { useEffect, useId, useState } from "react";

import { adminFetch } from "@/lib/admin-api";
import { useDialog } from "@/lib/use-dialog";
import GenerateAltButton from "./GenerateAltButton";

// The alt text of an image pasted or dropped into the editor (#377). The image
// goes in first, so writing is not interrupted; this asks for its description
// right after. Skipping leaves it empty, and the library flags it "Alt ?".
export default function PastedImageAltDialog({
  image,
  onClose,
  onSaved,
}: {
  image: { filename: string; url: string } | null;
  onClose: () => void;
  onSaved: (alt: string) => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const containerRef = useDialog({ open: image !== null, onClose });
  const [alt, setAlt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAlt("");
    setError(null);
  }, [image]);

  if (!image) return null;

  async function save() {
    if (!image) return;
    const trimmed = alt.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError(null);
    // Stored on the file too, so the library and every later insertion of the
    // same image carry it, as with an upload from the picker.
    const { status } = await adminFetch(`/files/${encodeURIComponent(image.filename)}/metadata`, {
      method: "PUT",
      body: JSON.stringify({ alt: trimmed }),
    });
    setIsSaving(false);
    if (status !== 200) {
      setError("Le texte alternatif n'a pas pu être enregistré. Réessayez.");
      return;
    }
    onSaved(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-noir/50" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-4 w-full max-w-lg rounded-xl bg-blanc p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-noir">
          Décrire l&apos;image collée
        </h2>
        <div className="mt-3 flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="h-20 w-28 shrink-0 rounded object-cover" />
          <p className="text-sm text-gris">
            Ce texte est lu aux personnes qui ne voient pas l&apos;image. Décrivez ce qu&apos;elle montre, en une phrase.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="mt-4 space-y-3"
        >
          <label htmlFor={inputId} className="block text-sm font-medium text-noir">
            Texte alternatif
          </label>
          <textarea
            id={inputId}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            rows={2}
            autoFocus
            className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
          <GenerateAltButton filename={image.filename} onGenerated={setAlt} />
          {error && (
            <p role="alert" className="text-sm text-terre-cuite">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gris/30 px-4 py-2 text-sm text-gris hover:bg-blanc-casse">
              Plus tard
            </button>
            <button
              type="submit"
              disabled={isSaving || !alt.trim()}
              className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
