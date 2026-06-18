import { useTranslations } from "next-intl";

import AboutCarousel, { type CarouselSlide } from "./AboutCarousel";

// Ambiance photos shown in the "Derrière le DevFest Toulouse" carousel (#59).
// Drop the images in public/images/about-carousel/ and list them here; the
// carousel renders only when this array is non-empty, so the block degrades
// gracefully to text-only until photos are added. `alt` keys are resolved from
// the home.about namespace.
const CAROUSEL_SLIDES: CarouselSlide[] = [
  // Example once photos are available:
  // { src: "/images/about-carousel/ambiance-2024-1.jpg", alt: "Le public du DevFest Toulouse 2024" },
];

export default function AboutSection() {
  const t = useTranslations("home.about");

  const hasCarousel = CAROUSEL_SLIDES.length > 0;

  return (
    <section className="px-6 py-10 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl bg-bismarck min-h-[400px] flex items-center">
          {/* Warm orange filter over the (future) background photo, replacing
              the previous black/red flat fill. A real photo can be dropped in
              behind these layers later. */}
          <div className="absolute inset-0 bg-gradient-to-br from-terre-cuite to-bismarck" />
          <div className="absolute inset-0 bg-terre-cuite/40 mix-blend-multiply" />

          <div
            className={`relative z-10 p-8 lg:p-16 w-full ${
              hasCarousel ? "grid gap-8 lg:grid-cols-2 lg:items-center" : "max-w-2xl"
            }`}
          >
            <div className="max-w-2xl">
              <h2 className="text-3xl lg:text-5xl font-bold text-blanc mb-6">
                {t("behindTitle")}
              </h2>
              <div className="bg-blanc/90 rounded-m p-6 lg:p-8">
                <p className="text-base lg:text-lg text-noir leading-relaxed">
                  {t("gdgDescription")}
                </p>
              </div>
            </div>

            {hasCarousel && (
              <AboutCarousel
                slides={CAROUSEL_SLIDES}
                prevLabel={t("carouselPrev")}
                nextLabel={t("carouselNext")}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
