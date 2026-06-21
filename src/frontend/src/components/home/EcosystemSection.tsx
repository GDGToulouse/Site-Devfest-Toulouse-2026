import { getTranslations } from "next-intl/server";

import { surfaceBgClass, type SectionSurface } from "./section-surface";
import type { EcosystemPartner } from "@/lib/types";

interface EcosystemSectionProps {
  partners: EcosystemPartner[];
  surface?: SectionSurface;
}

// Partners are fetched by the page so it can compute the section alternation
// over the visible sections (#135).
export default async function EcosystemSection({ partners, surface = "blanc" }: EcosystemSectionProps) {
  const t = await getTranslations("home.about");

  if (partners.length === 0) return null;

  return (
    <section className={`section-y px-6 ${surfaceBgClass(surface)}`}>
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="section-title text-2xl lg:text-4xl font-bold text-noir">
          {t("ecosystemTitle")}
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {partners.map((partner) => {
            const baseClasses =
              "px-8 py-3 rounded-[12px] border-2 border-bleu font-bold text-base transition-colors";
            const variantClasses = partner.isFeatured
              ? "bg-bleu text-blanc hover:bg-bleu/90"
              : "text-bleu hover:bg-bleu/10";
            return (
              <a
                key={`${partner.name}-${partner.url}`}
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${baseClasses} ${variantClasses}`}
              >
                {partner.name}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
