import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getEditionTalks } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ConferencesBrowser from "@/components/conferences/ConferencesBrowser";
import { localizedField } from "@/lib/i18n-helpers";
import { parseFavourites } from "@/lib/favourites";
import type { TalkFormat, TalkLevel } from "@/lib/types";

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

const TALK_FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"];
const TALK_LEVELS: TalkLevel[] = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"];

export default async function ConferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("conferences");
  const tf = await getTranslations("favourites");
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
  const levelLabels = Object.fromEntries(
    TALK_LEVELS.map((level) => [level, t(`level.${level}`)]),
  );

  // Distinct category names and languages present in this edition — only these
  // become filter chips, so we never offer a filter that matches nothing.
  const categoryLabels = [
    ...new Set(
      talks
        .map((talk) => (talk.category ? localizedField(talk.category, "name", locale) : ""))
        .filter(Boolean),
    ),
  ];
  const categories = categoryLabels.map((label) => ({ slug: label, label }));
  const languages = [...new Set(talks.map((talk) => talk.language).filter(Boolean))];

  // Read the initial filter state from the URL so a shared/bookmarked filtered
  // link renders correctly on the server (indexable) before hydration.
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const initial = {
    q: first(sp.q),
    format: first(sp.format),
    level: first(sp.level),
    language: first(sp.language),
    category: first(sp.category),
  };

  const labels = {
    search: t("filters.search"),
    filters: t("filters.filters"),
    format: t("filters.format"),
    level: t("filters.level"),
    language: t("filters.language"),
    category: t("filters.category"),
    moreFilters: t("filters.moreFilters"),
    reset: t("filters.reset"),
    noResults: t("filters.noResults"),
    sessions: t("filters.sessions"),
    formatLabels,
    levelLabels,
    languageLabels: { fr: t("filters.langFr"), en: t("filters.langEn") },
    favouriteLabels: { add: tf("add"), remove: tf("remove") },
  };

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("heading", { year })}
        </h1>

        {talks.length > 0 ? (
          <div className="mt-8">
            <ConferencesBrowser
              talks={talks}
              locale={locale}
              categories={categories}
              languages={languages}
              labels={labels}
              initial={initial}
              initialFavourites={parseFavourites(first(sp.fav))}
            />
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
