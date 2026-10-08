"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { adminFetch, humanError } from "@/lib/admin-api";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// The gallery of an edition (#112): photos picked from the media library,
// shown on the edition page in this order. The alt text is the photo's own, or
// failing that the one the media library holds for the file.

interface Photo {
  id: number;
  url: string;
  alt: string | null;
  ownAlt: string | null;
}

export default function PhotosTab({ editionId }: { editionId: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<Photo[]>(`/editions/${editionId}/photos`);
    setPhotos(data ?? []);
  }, [editionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(url: string) {
    const result = await adminFetch(`/editions/${editionId}/photos`, { method: "POST", body: JSON.stringify({ url }) });
    if (result.status !== 201) {
      setFeedback({ kind: "error", text: humanError(result, "La photo n'a pas pu être ajoutée.") });
      return;
    }
    setFeedback({ kind: "ok", text: "Photo ajoutée à la galerie." });
    await load();
  }

  async function move(index: number, step: -1 | 1) {
    if (!photos) return;
    const target = index + step;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setPhotos(reordered);
    const result = await adminFetch(`/editions/${editionId}/photos/order`, {
      method: "PUT",
      body: JSON.stringify({ ids: reordered.map((p) => p.id) }),
    });
    if (result.status !== 200) {
      setFeedback({ kind: "error", text: humanError(result, "Le nouvel ordre n'a pas pu être enregistré.") });
      await load();
    }
  }

  async function saveAlt(photo: Photo, alt: string) {
    if ((photo.ownAlt ?? "") === alt.trim()) return;
    const result = await adminFetch(`/edition-photos/${photo.id}`, { method: "PUT", body: JSON.stringify({ alt }) });
    if (result.status !== 200) {
      setFeedback({ kind: "error", text: humanError(result, "Le texte alternatif n'a pas pu être enregistré.") });
      return;
    }
    setFeedback({ kind: "ok", text: "Texte alternatif enregistré." });
    await load();
  }

  async function remove(photo: Photo) {
    const result = await adminFetch(`/edition-photos/${photo.id}`, { method: "DELETE" });
    if (result.status !== 204) {
      setFeedback({ kind: "error", text: humanError(result, "La photo n'a pas pu être retirée.") });
      return;
    }
    setFeedback({ kind: "ok", text: "Photo retirée de la galerie (elle reste dans la médiathèque)." });
    await load();
  }

  if (photos === null) return <p className="text-gris">Chargement...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-gris">
          Une sélection de photos, affichée sur la page de l&apos;édition dans cet ordre, avec un agrandissement au clic.
          Le lien vers l&apos;album complet (onglet Général, « Galerie URL ») reste en dessous.
        </p>
        <button
          type="button"
          onClick={() => setIsPicking(true)}
          className="shrink-0 rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90"
        >
          + Ajouter une photo
        </button>
      </div>

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

      {photos.length === 0 ? (
        <p className="text-sm text-gris">Aucune photo dans la galerie.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="space-y-2 rounded-xl bg-blanc p-3 shadow-card">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-blanc-casse">
                <Image src={photo.url} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
              </div>
              <label className="block text-xs font-medium text-noir" htmlFor={`alt-${photo.id}`}>
                Texte alternatif
              </label>
              <input
                id={`alt-${photo.id}`}
                defaultValue={photo.ownAlt ?? ""}
                placeholder={photo.alt ?? "Décrivez la photo"}
                onBlur={(e) => saveAlt(photo, e.target.value)}
                className="w-full rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-noir"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="flex gap-2">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Avancer la photo ${index + 1}`} className="px-1 text-gris hover:text-noir disabled:opacity-30">
                    ◀
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === photos.length - 1} aria-label={`Reculer la photo ${index + 1}`} className="px-1 text-gris hover:text-noir disabled:opacity-30">
                    ▶
                  </button>
                </span>
                <button type="button" onClick={() => remove(photo)} className="text-terre-cuite hover:underline">
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ImagePickerDialog open={isPicking} onClose={() => setIsPicking(false)} onSelect={(url) => add(url)} />
    </div>
  );
}
