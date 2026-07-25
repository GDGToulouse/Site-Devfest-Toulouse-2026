"use client";

import { useState, useEffect, useRef } from "react";
import { adminFetch } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import FileDetailsDialog from "@/components/admin/FileDetailsDialog";

interface FileInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  isImage: boolean;
  ext: string;
  alt: string | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fileIcon(ext: string): string {
  switch (ext) {
    case ".pdf": return "PDF";
    case ".ppt": case ".pptx": return "PPT";
    case ".doc": case ".docx": return "DOC";
    case ".xls": case ".xlsx": return "XLS";
    case ".svg": return "SVG";
    default: return "FILE";
  }
}

function fileIconColor(ext: string): string {
  switch (ext) {
    case ".pdf": return "bg-terre-cuite/20 text-terre-cuite";
    case ".ppt": case ".pptx": return "bg-orange/20 text-orange";
    case ".doc": case ".docx": return "bg-bleu/20 text-bleu";
    case ".xls": case ".xlsx": return "bg-malachite/20 text-malachite";
    default: return "bg-gris/20 text-gris";
  }
}

// Mirrors ALLOWED_MIMES in the backend (routes/admin/files.ts). SVG is back
// since #346, sanitized before storage and served under a sandbox CSP.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function FilesAdminPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "images" | "documents">("all");
  const [detailsTarget, setDetailsTarget] = useState<FileInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    setIsLoading(true);
    const { data } = await adminFetch<FileInfo[]>("/files");
    if (data) setFiles(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/admin/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Erreur lors de l'upload");
      } else {
        await loadFiles();
      }
    } catch {
      setError("Impossible de contacter le serveur");
    }

    setIsUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (fileList) {
      Array.from(fileList).forEach((f) => handleUpload(f));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    Array.from(droppedFiles).forEach((f) => handleUpload(f));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/files/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadFiles();
  }

  function copyUrl(url: string) {
    // Resolve against the public origin (the frontend domain) — never the
    // internal backend URL, which isn't reachable from the browser anyway.
    const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  const filtered = files.filter((f) => {
    if (filter === "images") return f.isImage;
    if (filter === "documents") return !f.isImage;
    return true;
  });

  const imageCount = files.filter((f) => f.isImage).length;
  const docCount = files.filter((f) => !f.isImage).length;

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-noir">Fichiers</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isUploading ? "Upload..." : "Uploader"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Filter tabs — see #233: confine overflow so the bar scrolls, not the page. */}
      <div className="flex gap-1 border-b border-gris/20 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            filter === "all"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Tous ({files.length})
        </button>
        <button
          onClick={() => setFilter("images")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            filter === "images"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Images ({imageCount})
        </button>
        <button
          onClick={() => setFilter("documents")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            filter === "documents"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Documents ({docCount})
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="bg-blanc rounded-xl shadow-card border-2 border-dashed border-gris/30 p-12 text-center hover:border-malachite/50 transition-colors"
        >
          <p className="text-gris mb-2">Aucun fichier</p>
          <p className="text-sm text-gris">Glissez des fichiers ici ou utilisez le bouton Uploader</p>
          <p className="text-xs text-gris mt-2">Images (JPEG, PNG, WebP, GIF, SVG, ICO) — Documents (PDF, PPT, DOC, XLS) — max 20 Mo</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
        >
          {filtered.map((file) => (
            <div key={file.filename} className="bg-blanc rounded-lg shadow-card overflow-hidden">
              <button
                type="button"
                onClick={() => setDetailsTarget(file)}
                aria-label={`Voir les détails de ${file.filename}`}
                className="block w-full aspect-square relative flex items-center justify-center bg-blanc-casse hover:opacity-80 transition-opacity cursor-pointer"
              >
                {file.isImage ? (
                  <img
                    src={file.url}
                    alt={file.alt || file.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${fileIconColor(file.ext)}`}>
                    {fileIcon(file.ext)}
                  </div>
                )}
                {file.isImage && !file.alt && (
                  <span
                    aria-label="Texte alternatif manquant"
                    title="Texte alternatif manquant"
                    className="absolute top-1 right-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-terre-cuite text-blanc"
                  >
                    Alt ?
                  </span>
                )}
              </button>
              <div className="p-2 space-y-0.5">
                <p className="text-[10px] text-noir truncate font-medium" title={file.filename}>{file.filename}</p>
                <p className="text-[10px] text-gris">{formatSize(file.size)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyUrl(file.url)}
                    className="text-[10px] text-bleu hover:underline"
                  >
                    {copiedUrl === file.url ? "Copié !" : "URL"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(file.filename)}
                    className="text-[10px] text-terre-cuite hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer le fichier"
        message="Cette action est irréversible. Le fichier sera supprimé du serveur."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />

      <FileDetailsDialog
        file={detailsTarget}
        onClose={() => setDetailsTarget(null)}
        onSaved={(updated) => {
          // Patch the file in the list so the missing-alt badge disappears
          // immediately without a full refetch.
          setFiles((prev) =>
            prev.map((f) => (f.filename === updated.filename ? { ...f, alt: updated.alt } : f)),
          );
        }}
      />
    </div>
  );
}
