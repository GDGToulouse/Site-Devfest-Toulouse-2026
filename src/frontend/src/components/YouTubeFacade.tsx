"use client";

import { useState, useCallback } from "react";

interface YouTubeFacadeProps {
  videoUrl: string;
  title?: string;
}

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
  const videoId = extractVideoId(videoUrl);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  if (!videoId) return null;

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnailUrl}
        alt={title}
        className="w-full h-full object-cover"
        loading="lazy"
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
