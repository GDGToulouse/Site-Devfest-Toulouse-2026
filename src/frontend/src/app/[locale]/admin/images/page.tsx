"use client";

import { useState, useEffect, useRef } from "react";
import { adminFetch } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface FileInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  isImage: boolean;
  ext: string;
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

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function FilesAdminPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "images" | "documents">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    setIsLoading(true);
    const { data } = await adminFetch<FileInfo[]>("/images");
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
      const res = await fetch(`${BACKEND_URL}/api/admin/images`, {
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
    await adminFetch(`/images/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadFiles();
  }

  function copyUrl(url: string) {
    const fullUrl = `${BACKEND_URL}${url}`;
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

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gris/20 mb-6">
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
          <p className="text-xs text-gris mt-2">Images (JPEG, PNG, WebP, GIF, SVG) — Documents (PDF, PPT, DOC, XLS) — max 20 Mo</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {filtered.map((file) => (
            <div key={file.filename} className="bg-blanc rounded-xl shadow-card overflow-hidden">
              <div className="aspect-square relative flex items-center justify-center bg-blanc-casse">
                {file.isImage ? (
                  <img
                    src={`${BACKEND_URL}${file.url}`}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-lg font-bold ${fileIconColor(file.ext)}`}>
                    {fileIcon(file.ext)}
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="text-xs text-noir truncate font-medium" title={file.filename}>{file.filename}</p>
                <p className="text-xs text-gris">{formatSize(file.size)}</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => copyUrl(file.url)}
                    className="text-xs text-bleu hover:underline"
                  >
                    {copiedUrl === file.url ? "Copie !" : "Copier URL"}
                  </button>
                  {file.isImage ? null : (
                    <a
                      href={`${BACKEND_URL}${file.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-bleu hover:underline"
                    >
                      Ouvrir
                    </a>
                  )}
                  <button
                    onClick={() => setDeleteTarget(file.filename)}
                    className="text-xs text-terre-cuite hover:underline"
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
        message="Cette action est irreversible. Le fichier sera supprime du serveur."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}
