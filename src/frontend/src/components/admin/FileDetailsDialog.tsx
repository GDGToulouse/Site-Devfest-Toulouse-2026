"use client";

import { useEffect, useId, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { useDialog } from "@/lib/use-dialog";
import GenerateAltButton from "./GenerateAltButton";
import TagInput from "./TagInput";
import { describeUsage, type FileUsage } from "@/lib/file-usage";

interface FileForDetails {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  isImage: boolean;
  ext: string;
  alt: string | null;
  /** Name on the editor's machine (#378); null for files uploaded before it was kept. */
  originalName: string | null;
  /** Who uses it (#483). */
  usages: FileUsage[];
  /** Media library tags (#373). */
  tags: FileTag[];
}

export interface FileTag {
  id: number;
  name: string;
  slug: string;
}

interface FileDetailsDialogProps {
  file: FileForDetails | null;
  onClose: () => void;
  onSaved: (updated: { filename: string; alt: string | null; tags: FileTag[] }) => void;
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
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [allTags, setAllTags] = useState<FileTag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  // Re-init the form whenever the open file changes.
  useEffect(() => {
    setAlt(file?.alt ?? "");
    setTagIds(file?.tags.map((t) => t.id) ?? []);
    setSaveStatus("idle");
  }, [file]);

  // The media library's own tags (#373), for the autocomplete.
  useEffect(() => {
    if (!isOpen) return;
    adminFetch<FileTag[]>("/file-tags").then(({ data }) => setAllTags(data ?? []));
  }, [isOpen]);

  if (!file) return null;

  const isAltDirty = file.isImage && (alt.trim() || null) !== (file.alt || null);
  const savedTagIds = file.tags.map((t) => t.id);
  const isTagsDirty = tagIds.length !== savedTagIds.length || tagIds.some((id) => !savedTagIds.includes(id));
  const isDirty = isAltDirty || isTagsDirty;

  async function handleSave() {
    if (!file) return;
    setIsSaving(true);
    setSaveStatus("idle");
    const encoded = encodeURIComponent(file.filename);
    let savedAlt = file.alt;
    let savedTags = file.tags;
    let isOk = true;
    if (isAltDirty) {
      const { data, status } = await adminFetch<{ filename: string; alt: string | null }>(`/files/${encoded}/metadata`, {
        method: "PUT",
        body: JSON.stringify({ alt: alt.trim() || null }),
      });
      if (status === 200 && data) savedAlt = data.alt;
      else isOk = false;
    }
    if (isOk && isTagsDirty) {
      const { data, status } = await adminFetch<{ tags: FileTag[] }>(`/files/${encoded}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tagIds }),
      });
      if (status === 200 && data) savedTags = data.tags;
      else isOk = false;
    }
    setIsSaving(false);
    if (isOk) {
      setSaveStatus("saved");
      onSaved({ filename: file.filename, alt: savedAlt, tags: savedTags });
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
          <h2
            id={titleId}
            className="text-lg font-bold text-noir truncate"
            title={file.originalName ? `${file.originalName} — ${file.filename}` : file.filename}
          >
            {file.originalName ?? file.filename}
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
            <dt className="text-gris">Utilisé par</dt>
            <dd className="text-noir">
              {file.usages.length === 0 ? (
                <span className="text-gris">Aucun usage référencé</span>
              ) : (
                <ul className="space-y-0.5">
                  {file.usages.map((u) => (
                    <li key={`${u.model}-${u.id}`}>{describeUsage(u)}</li>
                  ))}
                </ul>
              )}
            </dd>
          </dl>

          {file.isImage && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="alt-text-edit" className="block text-sm font-medium text-noir">
                  Texte alternatif (alt)
                </label>
                <GenerateAltButton
                  filename={file.filename}
                  disabled={isSaving}
                  onGenerated={(generated) => {
                    setAlt(generated);
                    setSaveStatus("idle");
                  }}
                />
              </div>
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
                « image ». Le bouton « Générer avec l&apos;IA » propose une suggestion à relire.
              </p>
            </div>
          )}
        </div>

        {/* Tags, for images and documents alike (#373). */}
        <div className="px-4 pb-4">
          <span className="mb-1 block text-sm font-medium text-noir">Tags</span>
          <TagInput
            label="Tags du fichier"
            createPath="/file-tags"
            allTags={allTags}
            selectedTagIds={tagIds}
            onChange={(ids) => {
              setTagIds(ids);
              setSaveStatus("idle");
            }}
            onTagCreated={(tag) => setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name, "fr")))}
          />
          <p className="mt-1 text-xs text-gris">Pour retrouver le fichier par sujet dans la médiathèque : logos, photos d&apos;édition…</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gris/20">
          <div className="text-sm">
            {saveStatus === "saved" && <span role="status" aria-live="polite" className="text-malachite">Modifications enregistrées.</span>}
            {saveStatus === "error" && (
              <span role="alert" className="text-terre-cuite">L&apos;enregistrement a échoué. Réessayez.</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
