"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-api";

interface GenerateAltButtonProps {
  /** Server-side filename (under /uploads). Required to call the API. */
  filename: string | null;
  /** Disable the button (e.g. while a save is in flight). */
  disabled?: boolean;
  /** Called with the generated alt text — the parent decides what to do with it. */
  onGenerated: (alt: string) => void;
  /** Optional callback to surface an error to the parent's UI. */
  onError?: (message: string) => void;
}

interface GenerateAltResponse {
  alt: string;
  model: string;
  durationMs: number;
  tokensUsed: { input: number; output: number };
}

interface GenerateAltErrorResponse {
  error: string;
  message?: string;
  retryAfterSec?: number;
}

/**
 * Small button that asks the backend to suggest an alt text for an
 * already-uploaded image. Doesn't save: hands the suggestion back to the
 * parent so the admin can review and edit before persisting.
 */
export default function GenerateAltButton({
  filename,
  disabled,
  onGenerated,
  onError,
}: GenerateAltButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleClick() {
    if (!filename) return;
    setIsGenerating(true);
    setLocalError(null);

    const { data, status } = await adminFetch<GenerateAltResponse | GenerateAltErrorResponse>(
      `/files/${encodeURIComponent(filename)}/generate-alt`,
      { method: "POST" },
    );

    setIsGenerating(false);

    if (status === 200 && data && "alt" in data) {
      onGenerated(data.alt);
      return;
    }

    // Friendly error messages for the most common cases — the rest fall
    // through to a generic message so we never expose stack traces.
    const errBody = data as GenerateAltErrorResponse | null;
    let message = "Échec de la génération automatique du texte alternatif.";
    if (status === 429) {
      message = errBody?.retryAfterSec
        ? `Quota Gemini atteint. Réessayez dans ${errBody.retryAfterSec}s.`
        : "Quota Gemini atteint. Réessayez plus tard.";
    } else if (status === 503) {
      message = "Service IA non configuré (clé API manquante).";
    } else if (status === 415) {
      message = "Ce format d'image n'est pas pris en charge (SVG / ICO non supportés).";
    } else if (status === 400) {
      message = "L'image n'a pas pu être analysée.";
    }
    setLocalError(message);
    onError?.(message);
  }

  // The button is hidden if there's no filename yet (e.g. picker upload step
  // before submission) — alt-text generation needs a file already on disk.
  if (!filename) return null;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isGenerating}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-bleu/40 text-bleu hover:bg-bleu/5 disabled:opacity-50"
      >
        <span aria-hidden="true">✨</span>
        {isGenerating ? "Génération en cours…" : "Générer avec l'IA"}
      </button>
      {localError && (
        <p role="alert" className="mt-1 text-xs text-terre-cuite">
          {localError}
        </p>
      )}
    </div>
  );
}
