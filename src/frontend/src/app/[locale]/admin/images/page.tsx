"use client";

import { useState, useEffect, useRef } from "react";
import { adminFetch } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface ImageInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ImagesAdminPage() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadImages() {
    setIsLoading(true);
    const { data } = await adminFetch<ImageInfo[]>("/images");
    if (data) setImages(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadImages();
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
        await loadImages();
      }
    } catch {
      setError("Impossible de contacter le serveur");
    }

    setIsUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so the same file can be uploaded again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await adminFetch(`/images/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadImages();
  }

  function copyUrl(url: string) {
    const fullUrl = `${BACKEND_URL}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  if (isLoading) return <p className="text-gris">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-noir">Images</h1>
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
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-terre-cuite/10 text-terre-cuite">{error}</div>
      )}

      {/* Drop zone when no images */}
      {images.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="bg-blanc rounded-xl shadow-card border-2 border-dashed border-gris/30 p-12 text-center hover:border-malachite/50 transition-colors"
        >
          <p className="text-gris mb-2">Aucune image</p>
          <p className="text-sm text-gris">Glissez une image ici ou utilisez le bouton Uploader</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {images.map((img) => (
            <div key={img.filename} className="bg-blanc rounded-xl shadow-card overflow-hidden group">
              <div className="aspect-square relative">
                <img
                  src={`${BACKEND_URL}${img.url}`}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3 space-y-1">
                <p className="text-xs text-noir truncate font-medium" title={img.filename}>{img.filename}</p>
                <p className="text-xs text-gris">{formatSize(img.size)}</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => copyUrl(img.url)}
                    className="text-xs text-bleu hover:underline"
                  >
                    {copiedUrl === img.url ? "Copie !" : "Copier URL"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(img.filename)}
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
        title="Supprimer l'image"
        message="Cette action est irreversible. L'image sera supprimee du serveur."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}
