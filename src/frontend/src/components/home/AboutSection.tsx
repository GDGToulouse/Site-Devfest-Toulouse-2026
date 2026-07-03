import { useTranslations } from "next-intl";

import { surfaceBgClass, type SectionSurface } from "./section-surface";

interface AboutSectionProps {
  surface?: SectionSurface;
}

export default function AboutSection({ surface = "blanc" }: AboutSectionProps) {
  const t = useTranslations("home.about");

  return (
    <section className={`section-y px-6 ${surfaceBgClass(surface)}`}>
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl bg-bismarck min-h-[400px] flex items-center">
          {/* Warm orange filter over the (future) background photo, replacing
              the previous black/red flat fill. A real photo can be dropped in
              behind these layers later. */}
          <div className="absolute inset-0 bg-gradient-to-br from-terre-cuite to-bismarck" />
          <div className="absolute inset-0 bg-terre-cuite/40 mix-blend-multiply" />

          <div className="relative z-10 p-8 lg:p-16 max-w-2xl">
            <h2 className="text-3xl lg:text-5xl font-bold text-blanc mb-6">
              {t("behindTitle")}
            </h2>
            <div className="bg-blanc/90 rounded-m p-6 lg:p-8">
              <p className="text-base lg:text-lg text-noir leading-relaxed">
                {t("gdgDescription")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
