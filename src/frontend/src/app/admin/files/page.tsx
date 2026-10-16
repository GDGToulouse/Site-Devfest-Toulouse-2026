"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { adminFetch } from "@/lib/admin-api";
import { useListParams } from "@/lib/use-list-params";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import ListPagination from "@/components/admin/ListPagination";
import FileDetailsDialog from "@/components/admin/FileDetailsDialog";
import { describeUsage, type FileUsage } from "@/lib/file-usage";

interface FileInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  isImage: boolean;
  ext: string;
  alt: string | null;
  // The name it had on the editor's machine (#378). Null for anything
  // uploaded before that was kept.
  originalName: string | null;
  // Who uses it, derived from the columns pointing at it (#483).
  usages: FileUsage[];
}

type FileTab = "all" | "images" | "documents" | "unused";

// One page of the library and the count of each tab (#416): the screen used to
// load every file and render a thumbnail for each.
interface FilePage {
  page: number;
  limit: number;
  total: number;
  counts: Record<FileTab, number>;
  items: FileInfo[];
}

const PAGE_SIZE = 48;
const LIST_KEYS = ["type"] as const;
const EMPTY_PAGE: FilePage = { page: 1, limit: PAGE_SIZE, total: 0, counts: { all: 0, images: 0, documents: 0, unused: 0 }, items: [] };

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
  const { params, page, update } = useListParams(LIST_KEYS);
  const filter: FileTab = (["images", "documents", "unused"] as const).find((t) => t === params.type) ?? "all";
  const [list, setList] = useState<FilePage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<FileInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filter !== "all") query.set("type", filter);
  const queryString = query.toString();

  const loadFiles = useCallback(async () => {
    const { data } = await adminFetch<FilePage>(`/files?${queryString}`);
    setList(data ?? EMPTY_PAGE);
  }, [queryString, setList]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  function setFilter(next: FileTab) {
    update({ type: next === "all" ? "" : next });
  }

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
      } else if (page > 1) {
        // The newest file opens the first page: go there to see it.
        update({ page: "" });
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
    setError("");
    const { status, error: serverError } = await adminFetch(`/files/${deleteTarget}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    // The server now refuses in 409 and names the entities still using the file
    // (#486) — show its sentence rather than the guess this used to print.
    if (status !== 204 && status !== 200) {
      setError(serverError ?? "La suppression a échoué. Réessayez.");
      return;
    }
    // The last file of a page gone: step back rather than show an empty page.
    if (list && list.items.length === 1 && page > 1) update({ page: String(page - 1) });
    else loadFiles();
  }

  function copyUrl(url: string) {
    // Resolve against the public origin (the frontend domain) — never the
    // internal backend URL, which isn't reachable from the browser anyway.
    const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  if (!list) return <p className="text-gris">Chargement…</p>;

  const filtered = list.items;
  const { counts } = list;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-noir">Fichiers</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isUploading ? "Upload…" : "Uploader"}
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
          Tous ({counts.all})
        </button>
        <button
          onClick={() => setFilter("images")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            filter === "images"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Images ({counts.images})
        </button>
        <button
          onClick={() => setFilter("documents")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            filter === "documents"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Documents ({counts.documents})
        </button>
        <button
          onClick={() => setFilter("unused")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            filter === "unused"
              ? "border border-gris/20 border-b-blanc bg-blanc text-noir"
              : "text-gris hover:text-noir"
          }`}
        >
          Non utilisés ({counts.unused})
        </button>
      </div>

      {/* "Unused" means no column points at the file: an image placed inside
          an article's text is not seen, so the screen says it (#483). */}
      {filter === "unused" && (
        <p className="mb-4 text-sm text-gris">
          Aucun usage référencé : ni speaker, sponsor, article, édition ni réglage n&apos;y renvoie. Une
          image insérée dans le texte d&apos;un article ou d&apos;une page n&apos;est pas détectée : vérifiez
          avant de supprimer.
        </p>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
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
                aria-label={`Voir les détails de ${file.originalName ?? file.filename}`}
                className="block w-full aspect-square relative flex items-center justify-center bg-blanc-casse hover:opacity-80 transition-opacity cursor-pointer"
              >
                {file.isImage ? (
                  <img
                    src={file.url}
                    alt={file.alt || file.filename}
                    loading="lazy"
                    decoding="async"
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
                {/* The name a human recognises first, the stored one on hover —
                    that one is still what the URL uses (#378). */}
                <p
                  className="text-[10px] text-noir truncate font-medium"
                  title={file.originalName ? `${file.originalName} — ${file.filename}` : file.filename}
                >
                  {file.originalName ?? file.filename}
                </p>
                {file.usages.length > 0 && (
                  <p
                    className="text-[10px] text-malachite truncate"
                    title={file.usages.map(describeUsage).join("\n")}
                  >
                    {describeUsage(file.usages[0])}
                    {file.usages.length > 1 && ` +${file.usages.length - 1}`}
                  </p>
                )}
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

      <ListPagination page={list.page} limit={list.limit} total={list.total} onPageChange={(next) => update({ page: String(next) })} />

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
          setList((prev) =>
            prev && { ...prev, items: prev.items.map((f) => (f.filename === updated.filename ? { ...f, alt: updated.alt } : f)) },
          );
        }}
      />
    </div>
  );
}
