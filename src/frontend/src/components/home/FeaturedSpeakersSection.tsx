import { getTranslations } from "next-intl/server";

import { getFeaturedSpeakers } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import SpeakerCard from "@/components/speakers/SpeakerCard";

export default async function FeaturedSpeakersSection() {
  const [t, speakers] = await Promise.all([
    getTranslations("home.featuredSpeakers"),
    getFeaturedSpeakers(),
  ]);

  // Hidden when no speaker is featured (US-202).
  if (speakers.length === 0) return null;

  return (
    <section className="section-y px-6">
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
