import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getEditionTalks } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ConferencesList from "@/components/conferences/ConferencesList";
import type { TalkFormat } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("conferences");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/conferences`,
      languages: { fr: "/fr/conferences", en: "/en/conferences", "x-default": "/fr/conferences" },
    },
  };
}

const TALK_FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE"];

export default async function ConferencesPage() {
  const locale = await getLocale();
  const t = await getTranslations("conferences");
  const edition = await getCurrentEdition();
  const year = edition?.year ?? new Date().getFullYear();
  const talks = edition ? await getEditionTalks(edition.year) : [];

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/conferences` },
  ];

  const formatLabels = Object.fromEntries(
    TALK_FORMATS.map((format) => [format, t(`format.${format}`)]),
  );

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("heading", { year })}
        </h1>

        {talks.length > 0 ? (
          <div className="mt-8">
            <ConferencesList talks={talks} locale={locale} formatLabels={formatLabels} />
          </div>
        ) : (
          <div className="mt-8 p-8 rounded-3xl bg-blanc shadow-card">
            <h2 className="text-2xl lg:text-3xl font-bold text-noir">
              {t("comingSoonTitle")}
            </h2>
            <p className="mt-4 text-lg text-gris leading-relaxed">
              {t("comingSoonBody", { year })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
