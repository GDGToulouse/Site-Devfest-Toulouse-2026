"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

interface YouTubeFacadeProps {
  videoUrl: string;
  title?: string;
}

// YouTube only generates maxresdefault (1280×720) for videos uploaded above a
// certain resolution; for the rest it answers 404. hqdefault always exists, so
// it takes over when the first one fails — otherwise the block would show an
// empty frame on exactly the older talks the replay archive is made of (#474).
const THUMBNAIL_QUALITIES = ["maxresdefault", "hqdefault"] as const;

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function YouTubeFacade({ videoUrl, title = "Video" }: YouTubeFacadeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [qualityIndex, setQualityIndex] = useState(0);
  const videoId = extractVideoId(videoUrl);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  // An URL we cannot parse still points at a real video — an admin may have
  // pasted a form we don't know. Dropping the block would make the talk look as
  // if it had never been filmed (#348), so fall back to the plain link.
  if (!videoId) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-terre-cuite px-4 py-2 text-sm font-medium text-blanc transition-colors hover:bg-terre-cuite/90"
      >
        <span aria-hidden="true">▶</span>
        {title}
      </a>
    );
  }

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${THUMBNAIL_QUALITIES[qualityIndex]}.jpg`;

  if (isPlaying) {
    return (
      <div className="relative w-full aspect-video rounded-3xl overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      className="relative w-full aspect-video rounded-3xl overflow-hidden group cursor-pointer"
      aria-label={`Play ${title}`}
    >
      {/* Through next/image, not a raw <img>: the proxy converts to AVIF and
          resizes to what is actually displayed — 80 kB became ~10 kB — and,
          more to the point, it is what makes the facade a facade. Served
          straight from img.youtube.com, the thumbnail called Google on every
          page load, before the visitor had asked for anything (#474). */}
      <Image
        key={thumbnailUrl}
        src={thumbnailUrl}
        alt={title}
        fill
        sizes="(min-width: 1024px) 896px, 100vw"
        className="object-cover"
        onError={() => setQualityIndex((i) => Math.min(i + 1, THUMBNAIL_QUALITIES.length - 1))}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-noir/30 group-hover:bg-noir/40 transition-colors" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 lg:w-20 lg:h-20 bg-rouge rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="w-8 h-8 lg:w-10 lg:h-10 ml-1"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
}
