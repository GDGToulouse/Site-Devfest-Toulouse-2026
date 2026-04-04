"use client";

import { useState, useEffect, useRef } from "react";
import { adminFetch } from "@/lib/admin-api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface ImageInfo {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
}

interface ImagePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function ImagePickerDialog({ open, onClose, onSelect }: ImagePickerDialogProps) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      loadImages();
      setSelected(null);
      setError(null);
    }
  }, [open]);

  async function loadImages() {
    setIsLoading(true);
    const { data } = await adminFetch<ImageInfo[]>("/images");
    if (data) setImages(data);
    setIsLoading(false);
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data, status } = await adminFetch<{ url: string }>("/images", {
        method: "POST",
        body: formData,
      });

      if (!data?.url) {
        setError(status === 413 ? "Fichier trop volumineux" : "Erreur lors de l'upload");
        setIsUploading(false);
        return;
      }

      // Auto-select the uploaded image and switch to library
      await loadImages();
      setSelected(`${BACKEND_URL}${data.url}`);
      setTab("library");
    } catch {
      setError("Impossible de contacter le serveur");
    }

    setIsUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-noir/50">
      <div className="bg-blanc rounded-xl shadow-card w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gris/20">
          <h2 className="text-lg font-bold text-noir">Bibliotheque d&apos;images</h2>
          <button onClick={onClose} className="text-gris hover:text-noir text-xl leading-none">&times;</button>
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
            Bibliotheque
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
          <div className="mx-4 mt-3 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">{error}</div>
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
                      onClick={() => setSelected(`${BACKEND_URL}${img.url}`)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                        selected === `${BACKEND_URL}${img.url}`
                          ? "border-malachite"
                          : "border-transparent hover:border-gris/30"
                      }`}
                    >
                      <img
                        src={`${BACKEND_URL}${img.url}`}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gris/30 rounded-xl p-8 text-center hover:border-malachite/50 transition-colors"
            >
              {isUploading ? (
                <p className="text-gris">Upload en cours...</p>
              ) : (
                <>
                  <p className="text-gris mb-4">Glissez une image ici ou cliquez pour selectionner</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
                  >
                    Choisir un fichier
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-xs text-gris mt-3">JPEG, PNG, WebP, GIF — max 5 Mo</p>
                </>
              )}
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
            Inserer
          </button>
        </div>
      </div>
    </div>
  );
}
