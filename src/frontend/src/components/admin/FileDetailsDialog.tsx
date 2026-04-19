"use client";

import { useEffect, useId, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { useDialog } from "@/lib/use-dialog";

interface FileForDetails {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  isImage: boolean;
  ext: string;
  alt: string | null;
}

interface FileDetailsDialogProps {
  file: FileForDetails | null;
  onClose: () => void;
  onSaved: (updated: { filename: string; alt: string | null }) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function FileDetailsDialog({ file, onClose, onSaved }: FileDetailsDialogProps) {
  const titleId = useId();
  const isOpen = file !== null;
  const containerRef = useDialog({ open: isOpen, onClose });

  const [alt, setAlt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  // Re-init the form whenever the open file changes.
  useEffect(() => {
    setAlt(file?.alt ?? "");
    setSaveStatus("idle");
  }, [file]);

  if (!file) return null;

  const isDirty = (alt.trim() || null) !== (file.alt || null);

  async function handleSave() {
    if (!file) return;
    setIsSaving(true);
    setSaveStatus("idle");
    const trimmed = alt.trim();
    const { data, status } = await adminFetch<{ filename: string; alt: string | null }>(
      `/files/${encodeURIComponent(file.filename)}/metadata`,
      { method: "PUT", body: JSON.stringify({ alt: trimmed || null }) },
    );
    setIsSaving(false);
    if (status === 200 && data) {
      setSaveStatus("saved");
      onSaved({ filename: data.filename, alt: data.alt });
      setTimeout(() => setSaveStatus("idle"), 2500);
    } else {
      setSaveStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-noir/50"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-blanc rounded-xl shadow-card w-full max-w-2xl max-h-[85vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gris/20">
          <h2 id={titleId} className="text-lg font-bold text-noir truncate" title={file.filename}>
            {file.filename}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
            className="text-gris hover:text-noir text-xl leading-none ml-4"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {file.isImage ? (
            <div className="flex justify-center bg-blanc-casse rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.alt || file.filename}
                className="max-h-64 object-contain"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center bg-blanc-casse rounded-lg p-8">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bleu hover:underline"
              >
                Ouvrir le fichier dans un nouvel onglet
              </a>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gris">Type</dt>
            <dd className="text-noir font-mono text-xs">{file.ext || "?"}</dd>
            <dt className="text-gris">Taille</dt>
            <dd className="text-noir">{formatSize(file.size)}</dd>
            <dt className="text-gris">Téléversé le</dt>
            <dd className="text-noir">{formatDate(file.uploadedAt)}</dd>
            <dt className="text-gris">URL</dt>
            <dd className="text-noir font-mono text-xs break-all">{file.url}</dd>
          </dl>

          {file.isImage && (
            <div>
              <label htmlFor="alt-text-edit" className="block text-sm font-medium text-noir mb-1">
                Texte alternatif (alt)
              </label>
              <textarea
                id="alt-text-edit"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Décrivez l'image pour les lecteurs d'écran (laisser vide pour les images purement décoratives)."
                rows={3}
                disabled={isSaving}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gris">
                Important pour l&apos;accessibilité. Décrit ce qu&apos;on voit ou son rôle, sans le mot
                « image ».
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gris/20">
          <div className="text-sm">
            {saveStatus === "saved" && <span className="text-malachite">Enregistré !</span>}
            {saveStatus === "error" && (
              <span className="text-terre-cuite">Erreur lors de l&apos;enregistrement</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
            >
              Fermer
            </button>
            {file.isImage && (
              <button
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
