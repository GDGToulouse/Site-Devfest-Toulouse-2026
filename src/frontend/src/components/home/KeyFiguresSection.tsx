import Image from "next/image";
import { useTranslations } from "next-intl";

import StatIcon from "./StatIcon";
import { localizedField } from "@/lib/i18n-helpers";
import type { KeyFigure } from "@/lib/types";

interface KeyFiguresSectionProps {
  figures: KeyFigure[];
  locale: string;
}

// Rendered inside the hero (#134): big centred catch-phrase title above the
// stats card, sized to fit on the first screen without scrolling. Uses a div
// (not a <section>) since it lives within the hero <section>.
export default function KeyFiguresSection({ figures, locale }: KeyFiguresSectionProps) {
  const t = useTranslations("home.stats");

  if (figures.length === 0) return null;

  return (
    <div className="hero-figures relative px-6">
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
        <h2 className="hero-figures-title text-2xl sm:text-3xl lg:text-4xl font-bold text-noir text-center">
          {t.rich("title", {
            tech: (chunks) => <span className="text-malachite">{chunks}</span>,
            toulousain: (chunks) => <span className="text-terre-cuite">{chunks}</span>,
          })}
        </h2>

        <div className="relative bg-blanc rounded-4xl shadow-section p-5 lg:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
            {figures.map((figure) => (
              <div
                key={figure.icon}
                className="flex flex-col items-center text-center p-2 rounded-xl"
              >
                <StatIcon name={figure.icon} className="text-2xl lg:text-4xl" />
                <span className="mt-1 text-3xl lg:text-[40px] font-bold text-noir">
                  {figure.value}
                </span>
                <span className="mt-1 text-sm lg:text-lg text-gris">
                  {localizedField(figure, "label", locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
