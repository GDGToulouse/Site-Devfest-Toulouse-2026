"use client";

import { useState, useEffect, useRef, useId } from "react";
import { adminFetch } from "@/lib/admin-api";
import { useDialog } from "@/lib/use-dialog";

// Stripped-down sibling of ImagePickerDialog used for documents (today:
// the sponsor brochure PDF). No preview, no alt text — a PDF doesn't
// benefit from a thumbnail card and alt is irrelevant for a downloadable
// asset. Library filters to the target extensions passed via `accept`.

interface FileInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  ext: string;
}

interface UploadResponse {
  filename: string;
  url: string;
  size: number;
}

function formatKb(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} Mo`
    : `${Math.round(bytes / 1024)} Ko`;
}

interface FilePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  /**
   * Accepted extensions (dot-prefixed, lowercase). Also forwarded to the
   * native <input accept=""> attribute. Default: [".pdf"].
   */
  extensions?: string[];
  /** MIME types accepted on the <input accept=""> attribute. */
  mimeTypes?: string[];
  /** Dialog heading. Default: "Bibliothèque de fichiers". */
  title?: string;
  /** Hint shown under the dropzone. */
  hint?: string;
}

export default function FilePickerDialog({
  open,
  onClose,
  onSelect,
  extensions = [".pdf"],
  mimeTypes = ["application/pdf"],
  title = "Bibliothèque de fichiers",
  hint = "PDF — max 20 Mo",
}: FilePickerDialogProps) {
  const titleId = useId();
  const dialogRef = useDialog({ open, onClose });
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptAttr = [...mimeTypes, ...extensions].join(",");

  useEffect(() => {
    if (open) {
      loadFiles();
      setSelected(null);
      setError(null);
    }
  }, [open]);

  async function loadFiles() {
    setIsLoading(true);
    const { data } = await adminFetch<FileInfo[]>("/files");
    if (data) {
      const allowed = new Set(extensions.map((e) => e.toLowerCase()));
      setFiles(data.filter((f) => allowed.has(f.ext.toLowerCase())));
    }
    setIsLoading(false);
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const { data, status } = await adminFetch<UploadResponse>("/files", {
      method: "POST",
      body: formData,
    });

    if (!data?.url) {
      setError(status === 413 ? "Fichier trop volumineux" : "Erreur lors de l'upload");
      setIsUploading(false);
      return;
    }

    await loadFiles();
    setSelected(data.url);
    setTab("library");
    setIsUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
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
        <div className="flex items-center justify-between p-4 border-b border-gris/20">
          <h2 id={titleId} className="text-lg font-bold text-noir">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
            className="text-gris hover:text-noir text-xl leading-none"
          >
            &times;
          </button>
        </div>

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

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "library" && (
            <>
              {isLoading ? (
                <p className="text-gris text-center py-8">Chargement...</p>
              ) : files.length === 0 ? (
                <p className="text-gris text-center py-8">Aucun fichier. Uploadez-en un !</p>
              ) : (
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li key={f.filename}>
                      <button
                        onClick={() => setSelected(f.url)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                          selected === f.url
                            ? "border-malachite bg-malachite/5"
                            : "border-gris/20 hover:bg-blanc-casse"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-noir truncate" title={f.filename}>
                            {f.filename}
                          </p>
                          <p className="text-xs text-gris">
                            {formatKb(f.size)} · {new Date(f.uploadedAt).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <span className="text-xs uppercase text-gris tracking-wide shrink-0">
                          {f.ext.replace(".", "")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gris/30 rounded-xl p-8 text-center hover:border-malachite/50 transition-colors"
            >
              <p className="text-gris mb-4">Glissez un fichier ici ou cliquez pour sélectionner</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
              >
                {isUploading ? "Téléversement…" : "Choisir un fichier"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptAttr}
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-xs text-gris mt-3">{hint}</p>
            </div>
          )}
        </div>

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
