"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

// The photos of an edition (#112): a grid of thumbnails, each opening the
// photo large in a native <dialog> — focus kept inside, Escape to close, the
// arrows to go through the gallery — and focus back on the thumbnail after.

export interface GalleryPhoto {
  url: string;
  alt: string | null;
}

export default function EditionGallery({ photos, year }: { photos: GalleryPhoto[]; year: number }) {
  const t = useTranslations("bilan");
  const dialog = useRef<HTMLDialogElement>(null);
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  const altOf = (photo: GalleryPhoto, i: number) => photo.alt || t("photoAlt", { year, n: i + 1 });

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (index !== null && !el.open) el.showModal();
  }, [index]);

  function close() {
    const last = index;
    dialog.current?.close();
    setIndex(null);
    if (last !== null) thumbnails.current[last]?.focus();
  }

  function go(step: number) {
    setIndex((i) => (i === null ? i : (i + step + photos.length) % photos.length));
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.url}>
            <button
              ref={(el) => {
                thumbnails.current[i] = el;
              }}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t("photoOpen", { alt: altOf(photo, i) })}
              className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-blanc-casse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu"
            >
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={t("gallery")}
        onClose={() => index !== null && close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        // Clicking the backdrop (the dialog element itself) closes it.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-noir/90"
      >
        {index !== null && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-4" onClick={(e) => e.target === e.currentTarget && close()}>
            <div className="relative h-[75vh] w-full max-w-6xl">
              <Image src={photos[index].url} alt={altOf(photos[index], index)} fill sizes="100vw" className="object-contain" />
            </div>
            <p className="max-w-3xl text-center text-sm text-blanc">
              {altOf(photos[index], index)} · {t("photoCount", { n: index + 1, total: photos.length })}
            </p>
            <div className="flex gap-3">
              {photos.length > 1 && (
                <button type="button" onClick={() => go(-1)} className="rounded-full bg-blanc px-5 py-2 font-bold text-noir">
                  {t("photoPrevious")}
                </button>
              )}
              <button type="button" onClick={close} autoFocus className="rounded-full bg-blanc px-5 py-2 font-bold text-noir">
                {t("photoClose")}
              </button>
              {photos.length > 1 && (
                <button type="button" onClick={() => go(1)} className="rounded-full bg-blanc px-5 py-2 font-bold text-noir">
                  {t("photoNext")}
                </button>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
