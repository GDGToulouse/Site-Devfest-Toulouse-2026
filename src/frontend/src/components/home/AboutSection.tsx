import { getTranslations } from "next-intl/server";

import { getAboutCarousel } from "@/lib/api";
import AboutCarousel from "./AboutCarousel";

// "Derrière le DevFest Toulouse" home block. The ambiance carousel images are
// managed from the back-office (#99) and stored under the `about_carousel`
// setting; the block degrades to text-only when no image is configured.
export default async function AboutSection() {
  const t = await getTranslations("home.about");
  const slides = await getAboutCarousel();

  const hasCarousel = slides.length > 0;

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
              hasCarousel ? "grid gap-8 lg:grid-cols-2 lg:items-stretch" : "max-w-2xl"
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
                slides={slides}
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
