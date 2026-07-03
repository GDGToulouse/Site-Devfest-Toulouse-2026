import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getSpeakers } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import SpeakerCard from "@/components/speakers/SpeakerCard";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("speakers");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/speakers`,
      languages: { fr: "/fr/speakers", en: "/en/speakers", "x-default": "/fr/speakers" },
    },
  };
}

export default async function SpeakersPage() {
  const locale = await getLocale();
  const t = await getTranslations("speakers");
  const [edition, speakers] = await Promise.all([getCurrentEdition(), getSpeakers()]);
  const year = edition?.year ?? new Date().getFullYear();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/speakers` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("heading", { year })}
        </h1>

        {speakers.length === 0 ? (
          <p className="mt-12 text-lg text-gris">{t("empty")}</p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            {speakers.map((s) => (
              <SpeakerCard key={s.id} speaker={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
