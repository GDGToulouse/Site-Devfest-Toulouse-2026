"use client";

import { useRef } from "react";
import Image from "next/image";

import type { CarouselSlide } from "@/lib/types";

interface AboutCarouselProps {
  slides: CarouselSlide[];
  prevLabel: string;
  nextLabel: string;
}

// Lightweight, dependency-free carousel (CSS scroll-snap + arrow buttons) for
// the "Derrière le DevFest Toulouse" block (#59). Keyboard-accessible: the
// track is focusable and scrolls with arrow keys; buttons scroll by one slide.
export default function AboutCarousel({ slides, prevLabel, nextLabel }: AboutCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);

  function scrollByDir(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector("li");
    const step = slide ? slide.clientWidth + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  if (slides.length === 0) return null;

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        tabIndex={0}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory rounded-m [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blanc"
      >
        {slides.map((slide, i) => (
          <li
            key={slide.url}
            className="relative shrink-0 snap-start w-full sm:w-[80%] aspect-[16/10] overflow-hidden rounded-m bg-noir/20"
          >
            <Image
              src={slide.url}
              alt={slide.alt}
              fill
              sizes="(min-width: 640px) 60vw, 90vw"
              className="object-cover"
              priority={i === 0}
            />
          </li>
        ))}
      </ul>

      {slides.length > 1 && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label={prevLabel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-blanc/90 text-noir hover:bg-blanc transition-colors"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label={nextLabel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-blanc/90 text-noir hover:bg-blanc transition-colors"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
