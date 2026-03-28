import { useTranslations } from "next-intl";

import YouTubeFacade from "@/components/YouTubeFacade";

interface ReplaySectionProps {
  aftermovieUrl: string;
}

export default function ReplaySection({ aftermovieUrl }: ReplaySectionProps) {
  const t = useTranslations("home.replay");

  return (
    <section className="px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl lg:text-5xl font-bold text-noir text-center mb-10">
          {t("title")}
        </h2>
        <YouTubeFacade videoUrl={aftermovieUrl} title="DevFest Toulouse Aftermovie" />
      </div>
    </section>
  );
}
