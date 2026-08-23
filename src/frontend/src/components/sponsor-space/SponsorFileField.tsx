"use client";

import { useRef, useState } from "react";

import { uploadSponsorFile } from "@/lib/sponsor-api";

// Send a file from the sponsor's own machine (#362). Until now a sponsor could
// only paste a URL here, which meant hosting the file somewhere first — the
// edit link had a real upload and the account-based space did not.
//
// The upload only returns a URL; saving it is the parent form's job, so a file
// sent then abandoned changes nothing.
export default function SponsorFileField({
  label,
  hint,
  accept,
  value,
  fileName,
  sponsorId,
  canEdit,
  onChange,
}: {
  label: string;
  hint?: string;
  accept: string;
  value: string;
  /**
   * Name the file had on the sponsor's machine (#378), when it is known.
   *
   * Stored names are `<timestamp>-<random>.<ext>`, so a com kit reads as three
   * interchangeable links — and a PDF has no thumbnail to tell them apart by.
   */
  fileName?: string;
  sponsorId: number;
  canEdit: boolean;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The name of the file just sent, before the parent form is saved and the
  // payload comes back carrying it.
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const shownName = uploadedName ?? fileName ?? null;

  async function pick(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    const { data, status } = await uploadSponsorFile(sponsorId, file);
    setIsUploading(false);
    if (data) {
      setUploadedName(data.originalName ?? file.name);
      onChange(data.url);
      return;
    }
    setError(
      status === 413
        ? "Fichier trop lourd (5 Mo maximum)."
        : status === 400
          ? "Format non accepté. Utilisez une image (PNG, JPG, WebP, SVG) ou un PDF."
          : "L'envoi a échoué. Réessayez.",
    );
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-noir">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canEdit || isUploading}
          className="min-h-[24px] rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          {isUploading ? "Envoi…" : value ? "Changer le fichier" : "Choisir un fichier"}
        </button>
        {value && canEdit && (
          <button
            type="button"
            onClick={() => {
              setUploadedName(null);
              onChange("");
            }}
            className="min-h-[24px] text-sm text-terre-cuite hover:underline"
          >
            Retirer<span className="sr-only"> {label}</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            // Reset so picking the same file twice still fires onChange.
            e.target.value = "";
          }}
        />
      </div>

      {value && (
        // The link used to read `/uploads/1782114756366-b8f56c93.pdf`, which
        // named nothing (#378). `download` makes the browser save it under the
        // name the sponsor knows, rather than the stored one.
        <p className="mt-1 break-all text-xs text-gris">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            {...(shownName ? { download: shownName } : {})}
            className="hover:underline"
          >
            {shownName ?? value}
          </a>
        </p>
      )}
      {hint && !error && <p className="mt-1 text-xs text-gris">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-terre-cuite">
          {error}
        </p>
      )}
    </div>
  );
}
