"use client";

import { useId, useState } from "react";

import { adminFetch, humanError } from "@/lib/admin-api";

// Import a file by its URL (#617): the server downloads it, so an editor no
// longer saves a logo found on a sponsor's site only to upload it again. The
// refusal stays on screen (#394) and says why, in the backend's own words.
interface ImportFromUrlProps {
  onImported: (file: { url: string; filename: string }) => void;
}

export default function ImportFromUrl({ onImported }: ImportFromUrlProps) {
  const inputId = useId();
  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importUrl() {
    if (!url.trim()) return;
    setIsImporting(true);
    setError(null);
    const result = await adminFetch<{ url: string; filename: string }>("/files/import-url", {
      method: "POST",
      body: JSON.stringify({ url: url.trim() }),
    });
    setIsImporting(false);
    if (result.status !== 201 || !result.data) {
      setError(humanError(result, "L'import a échoué. Vérifiez l'adresse et réessayez."));
      return;
    }
    setUrl("");
    onImported(result.data);
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-noir">
        Importer depuis une URL
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void importUrl();
            }
          }}
          placeholder="https://…/logo.png"
          className="min-w-0 flex-1 rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
        />
        <button
          type="button"
          onClick={() => void importUrl()}
          disabled={isImporting || !url.trim()}
          className="shrink-0 rounded-lg border border-gris/30 px-4 py-2 text-sm font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          {isImporting ? "Import…" : "Importer"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-terre-cuite">
          {error}
        </p>
      )}
    </div>
  );
}
