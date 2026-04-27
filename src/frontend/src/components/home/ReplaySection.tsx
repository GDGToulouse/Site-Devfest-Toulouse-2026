import { useTranslations } from "next-intl";

import YouTubeFacade from "@/components/YouTubeFacade";
import { Link } from "@/i18n/navigation";

interface ReplaySectionProps {
  aftermovieUrl: string;
  galleryUrl?: string | null;
  editionYear?: number | null;
}

export default function ReplaySection({
  aftermovieUrl,
  galleryUrl,
  editionYear,
}: ReplaySectionProps) {
  const t = useTranslations("home.replay");
  const hasCtas = Boolean(galleryUrl) || Boolean(editionYear);

  return (
    <section className="px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl lg:text-5xl font-bold text-noir text-center mb-10">
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
