import { useTranslations } from "next-intl";

import YouTubeFacade from "@/components/YouTubeFacade";
import { Link } from "@/i18n/navigation";
import { surfaceBgClass, type SectionSurface } from "./section-surface";

interface ReplaySectionProps {
  aftermovieUrl: string;
  galleryUrl?: string | null;
  editionYear?: number | null;
  surface?: SectionSurface;
}

export default function ReplaySection({
  aftermovieUrl,
  galleryUrl,
  editionYear,
  surface = "blanc",
}: ReplaySectionProps) {
  const t = useTranslations("home.replay");
  const hasCtas = Boolean(galleryUrl) || Boolean(editionYear);

  return (
    <section className={`section-y px-6 ${surfaceBgClass(surface)}`}>
      <div className="mx-auto max-w-4xl">
        <h2 className="section-title text-3xl lg:text-5xl font-bold text-noir text-center">
          {editionYear ? t("title", { year: editionYear }) : t("titleFallback")}
        </h2>
        <YouTubeFacade videoUrl={aftermovieUrl} title="DevFest Toulouse Aftermovie" />
        {hasCtas && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {galleryUrl && (
              <a
                href={galleryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-[12px] border-2 border-bleu px-6 py-3 text-base font-bold text-bleu hover:bg-bleu/10 transition-colors"
              >
                {t("viewGallery")}
              </a>
            )}
            {editionYear && (
              <Link
                href={`/editions/${editionYear}`}
                className="inline-block rounded-[12px] bg-bleu px-6 py-3 text-base font-bold text-blanc hover:bg-bleu/90 transition-colors"
              >
                {t("viewEdition", { year: editionYear })}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
