import Image from "next/image";
import { useTranslations } from "next-intl";

import StatIcon from "./StatIcon";
import { localizedField } from "@/lib/i18n-helpers";
import { surfaceBgClass, type SectionSurface } from "./section-surface";
import type { KeyFigure } from "@/lib/types";

interface KeyFiguresSectionProps {
  figures: KeyFigure[];
  locale: string;
  surface?: SectionSurface;
}

export default function KeyFiguresSection({ figures, locale, surface = "accent" }: KeyFiguresSectionProps) {
  const t = useTranslations("home.stats");

  if (figures.length === 0) return null;

  // Reduced top padding keeps the title on the first PC screen (#134);
  // bottom padding matches the shared section rhythm (.section-y, #135).
  return (
    <section className={`relative px-6 pt-6 lg:pt-8 pb-[clamp(40px,5vw,72px)] ${surfaceBgClass(surface)}`}>
      {/* La Grave illustration — sits on the page background, behind the card,
          peeking out from the bottom-left rather than being boxed inside the
          white card. */}
      <div className="hidden lg:block absolute left-0 bottom-0 w-48 h-64 opacity-20 pointer-events-none">
        <Image
          src="/images/illustrations/la-grave.png"
          alt=""
          fill
          className="object-contain object-left-bottom"
          sizes="192px"
          loading="lazy"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <h2 className="section-title text-3xl sm:text-4xl lg:text-[64px] lg:leading-[120%] font-bold text-noir text-center">
          {t.rich("title", {
            tech: (chunks) => <span className="text-malachite">{chunks}</span>,
            toulousain: (chunks) => <span className="text-terre-cuite">{chunks}</span>,
          })}
        </h2>

        <div className="relative bg-blanc rounded-4xl shadow-section p-8 lg:p-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-12">
            {figures.map((figure) => (
              <div
                key={figure.icon}
                className="flex flex-col items-center text-center p-6 rounded-xl"
              >
                <StatIcon name={figure.icon} className="text-4xl lg:text-[56px]" />
                <span className="mt-3 text-4xl lg:text-[56px] lg:leading-[140%] font-bold text-noir">
                  {figure.value}
                </span>
                <span className="mt-2 text-lg lg:text-2xl text-gris">
                  {localizedField(figure, "label", locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
