"use client";

import { useState, useEffect, useRef, useId } from "react";
import { adminFetch } from "@/lib/admin-api";
import { useDialog } from "@/lib/use-dialog";
import GenerateAltButton from "./GenerateAltButton";

interface ImageInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  alt: string | null;
}

interface UploadResponse {
  filename: string;
  url: string;
  size: number;
  alt: string | null;
  compression: {
    originalSize: number;
    finalSize: number;
    originalWidth: number | null;
    originalHeight: number | null;
    finalWidth: number | null;
    finalHeight: number | null;
    resized: boolean;
  } | null;
}

function formatKb(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} Mo`
    : `${Math.round(bytes / 1024)} Ko`;
}

interface ImagePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function ImagePickerDialog({ open, onClose, onSelect }: ImagePickerDialogProps) {
  const titleId = useId();
  // Focus trap + Escape + focus restore — hook handles the open/close lifecycle.
  const dialogRef = useDialog({ open, onClose });
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Two-step upload flow: pick a file → preview + fill alt → confirm.
  // Lets us collect accessibility metadata before sending the upload.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingAlt, setPendingAlt] = useState("");
  // Set when the user clicks "Generate with AI" before final upload: we
  // upload the file early so the backend has a path to read pixels from,
  // then the final "Téléverser" click only persists the alt metadata.
  const [pendingUploadedFilename, setPendingUploadedFilename] = useState<string | null>(null);
  const [isPreUploading, setIsPreUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      loadImages();
      setSelected(null);
      setError(null);
      setNotice(null);
      setPendingFile(null);
      setPendingPreview(null);
      setPendingAlt("");
      setPendingUploadedFilename(null);
    }
  }, [open]);

  // Revoke the preview URL on unmount / when it changes — otherwise the
  // ObjectURL keeps the file alive in memory.
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  async function loadImages() {
    setIsLoading(true);
    const { data } = await adminFetch<ImageInfo[]>("/files");
    if (data) setImages(data);
    setIsLoading(false);
  }

  function handleFileSelected(file: File) {
    setError(null);
    setNotice(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setPendingAlt("");
    setPendingUploadedFilename(null);
  }

  function cancelPending() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setPendingAlt("");
    // Note: we intentionally don't delete pendingUploadedFilename's file
    // from the server — if the admin pre-uploaded for AI generation then
    // changed their mind, the file stays in the library. Could be cleaned
    // up later, but a stray file is less surprising than silently deleting.
    setPendingUploadedFilename(null);
  }

  /**
   * Upload the pending file with the current alt (if any). Returns the
   * server response so callers can chain on it (e.g. trigger AI generation
   * right after).
   */
  async function uploadPendingFile(altOverride?: string): Promise<UploadResponse | null> {
    if (!pendingFile) return null;
    const formData = new FormData();
    formData.append("file", pendingFile);
    const altToSend = (altOverride ?? pendingAlt).trim();
    if (altToSend) formData.append("alt", altToSend);

    const { data, status } = await adminFetch<UploadResponse>("/files", {
      method: "POST",
      body: formData,
    });

    if (!data?.url) {
      setError(status === 413 ? "Fichier trop volumineux" : "Erreur lors de l'upload");
      return null;
    }

    if (data.compression) {
      const c = data.compression;
      const sizeMsg = `${formatKb(c.originalSize)} → ${formatKb(c.finalSize)}`;
      const resizeMsg =
        c.resized && c.originalWidth && c.finalWidth
          ? ` · redimensionnée de ${c.originalWidth}px à ${c.finalWidth}px de large`
          : "";
      setNotice(`Image optimisée automatiquement (${sizeMsg})${resizeMsg}.`);
    }

    return data;
  }

  /**
   * Triggered by the "Générer avec l'IA" button while still in the pending
   * preview screen. We upload the file first (without alt) so the backend
   * has bytes to inspect, then the GenerateAltButton handles the actual
   * generation once given a real filename.
   */
  async function preUploadForAi(): Promise<string | null> {
    if (pendingUploadedFilename) return pendingUploadedFilename;
    setIsPreUploading(true);
    setError(null);
    const data = await uploadPendingFile("");
    setIsPreUploading(false);
    if (!data) return null;
    setPendingUploadedFilename(data.filename);
    return data.filename;
  }

  async function handleUpload() {
    if (!pendingFile) return;
    setIsUploading(true);
    setError(null);
    setNotice(null);

    try {
      let finalUrl: string | null = null;

      if (pendingUploadedFilename) {
        // File is already on the server (the AI button triggered an early
        // upload). Just persist the (possibly edited) alt via PUT metadata.
        finalUrl = `/uploads/${pendingUploadedFilename}`;
        if (pendingAlt.trim()) {
          await adminFetch(`/files/${encodeURIComponent(pendingUploadedFilename)}/metadata`, {
            method: "PUT",
            body: JSON.stringify({ alt: pendingAlt.trim() }),
          });
        }
      } else {
        // Standard path: single POST that uploads + sets alt in one shot.
        const data = await uploadPendingFile();
        if (!data) {
          setIsUploading(false);
          return;
        }
        finalUrl = data.url;
      }

      // Auto-select the uploaded image and switch to library
      cancelPending();
      await loadImages();
      setSelected(finalUrl);
      setTab("library");
    } catch {
      setError("Impossible de contacter le serveur");
    }

    setIsUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  }

  function handleInsert() {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-noir/50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-blanc rounded-xl shadow-card w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gris/20">
          <h2 id={titleId} className="text-lg font-bold text-noir">Bibliothèque d&apos;images</h2>
          <button
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
            className="text-gris hover:text-noir text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-gris/20">
          <button
            onClick={() => setTab("library")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
              tab === "library"
                ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
                : "text-gris hover:text-noir"
            }`}
          >
            Bibliothèque
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
              tab === "upload"
                ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
                : "text-gris hover:text-noir"
            }`}
          >
            Upload
          </button>
        </div>

        {error && (
          <div role="alert" aria-live="assertive" className="mx-4 mt-3 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">{error}</div>
        )}
        {notice && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-malachite/10 text-malachite text-sm">
            {notice}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "library" && (
            <>
              {isLoading ? (
                <p className="text-gris text-center py-8">Chargement...</p>
              ) : images.length === 0 ? (
                <p className="text-gris text-center py-8">Aucune image. Uploadez-en une !</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <button
                      key={img.filename}
                      onClick={() => setSelected(img.url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                        selected === img.url
                          ? "border-malachite"
                          : "border-transparent hover:border-gris/30"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "upload" && !pendingFile && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gris/30 rounded-xl p-8 text-center hover:border-malachite/50 transition-colors"
            >
              <p className="text-gris mb-4">Glissez une image ici ou cliquez pour sélectionner</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
              >
                Choisir un fichier
              </button>
              {/* SVG is accepted again since #346: the backend strips scripts,
                  handlers and remote references before storing it. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico,.svg"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-xs text-gris mt-3">JPEG, PNG, WebP, GIF, SVG, ICO — max 20 Mo</p>
            </div>
          )}

          {tab === "upload" && pendingFile && (
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                {pendingPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingPreview}
                    alt="Aperçu de l'image à uploader"
                    className="w-32 h-32 object-cover rounded-lg bg-blanc-casse border border-gris/20"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-noir truncate" title={pendingFile.name}>
                    {pendingFile.name}
                  </p>
                  <p className="text-xs text-gris">{formatKb(pendingFile.size)}</p>
                  <button
                    type="button"
                    onClick={cancelPending}
                    className="mt-2 text-xs text-terre-cuite hover:underline"
                    disabled={isUploading}
                  >
                    Choisir une autre image
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="alt-text" className="block text-sm font-medium text-noir">
                    Texte alternatif (alt)
                  </label>
                  {/* When the user clicks the AI button before submitting, we
                      pre-upload the file so the backend has bytes to inspect.
                      Once uploaded, the button stays available so they can
                      re-generate if the first suggestion isn't great. */}
                  {pendingUploadedFilename ? (
                    <GenerateAltButton
                      filename={pendingUploadedFilename}
                      disabled={isUploading || isPreUploading}
                      onGenerated={(generated) => setPendingAlt(generated)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        const filename = await preUploadForAi();
                        if (!filename) return;
                        // Trigger generation right after the pre-upload finishes.
                        const { data, status } = await adminFetch<{ alt: string }>(
                          `/files/${encodeURIComponent(filename)}/generate-alt`,
                          { method: "POST" },
                        );
                        if (status === 200 && data?.alt !== undefined) {
                          setPendingAlt(data.alt);
                        } else {
                          setError("Échec de la génération du texte alternatif.");
                        }
                      }}
                      disabled={isUploading || isPreUploading}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-bleu/40 text-bleu hover:bg-bleu/5 disabled:opacity-50"
                    >
                      <span aria-hidden="true">✨</span>
                      {isPreUploading ? "Préparation…" : "Générer avec l'IA"}
                    </button>
                  )}
                </div>
                <textarea
                  id="alt-text"
                  value={pendingAlt}
                  onChange={(e) => setPendingAlt(e.target.value)}
                  placeholder="Décrivez l'image pour les lecteurs d'écran (laisser vide pour les images purement décoratives)."
                  rows={2}
                  disabled={isUploading}
                  className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-gris">
                  Important pour l&apos;accessibilité. Ne contient pas le mot « image », décrit ce qu&apos;on voit ou son rôle.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
                >
                  {isUploading
                    ? "Enregistrement…"
                    : pendingUploadedFilename
                      ? "Valider"
                      : "Téléverser"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gris/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Annuler
          </button>
          <button
            onClick={handleInsert}
            disabled={!selected}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}
