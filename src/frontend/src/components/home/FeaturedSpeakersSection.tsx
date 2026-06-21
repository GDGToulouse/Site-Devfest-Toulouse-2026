import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import SpeakerCard from "@/components/speakers/SpeakerCard";
import { surfaceBgClass, type SectionSurface } from "./section-surface";
import type { SpeakerPublic } from "@/lib/types";

interface FeaturedSpeakersSectionProps {
  speakers: SpeakerPublic[];
  surface?: SectionSurface;
}

// Speakers are fetched by the page so it can compute the section alternation
// over the visible sections (#135).
export default async function FeaturedSpeakersSection({
  speakers,
  surface = "blanc",
}: FeaturedSpeakersSectionProps) {
  const t = await getTranslations("home.featuredSpeakers");

  // Hidden when no speaker is featured (US-202).
  if (speakers.length === 0) return null;

  return (
    <section className={`section-y px-6 ${surfaceBgClass(surface)}`}>
      <div className="mx-auto max-w-6xl">
        <h2 className="section-title text-2xl font-bold text-noir lg:text-4xl">{t("title")}</h2>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          {speakers.map((s) => (
            <SpeakerCard key={s.id} speaker={s} />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/speakers" className="font-bold text-bleu hover:underline">
            {t("seeAll")}
          </Link>
        </div>
      </div>
    </section>
  );
}
