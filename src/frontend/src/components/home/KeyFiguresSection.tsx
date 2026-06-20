import Image from "next/image";

import StatIcon from "./StatIcon";
import { localizedField } from "@/lib/i18n-helpers";
import type { KeyFigure } from "@/lib/types";

interface KeyFiguresSectionProps {
  figures: KeyFigure[];
  locale: string;
}

export default function KeyFiguresSection({ figures, locale }: KeyFiguresSectionProps) {
  if (figures.length === 0) return null;

  // The catch-phrase title now lives in the hero (#134); this section keeps
  // the figures card only. Shared section rhythm via .section-y (#135).
  return (
    <section className="section-y relative px-6">
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
