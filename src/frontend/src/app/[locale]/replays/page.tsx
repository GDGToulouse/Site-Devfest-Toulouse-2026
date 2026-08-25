import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getReplays, getReplayFilters } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ReplayCard from "@/components/replays/ReplayCard";
import ReplayFiltersBar from "@/components/replays/ReplayFiltersBar";
import type { TalkFormat } from "@/lib/types";
import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("replays");
  return {
    title: t("pageTitle"),
    description: t("description"),
    ...(await pageMetadata(locale, "/replays")),
  };
}

const TALK_FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"];

export default async function ReplaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("replays");

  // Filters live in the URL and are applied server-side, so a filtered view is
  // shareable and rendered (indexable) rather than assembled in the browser.
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const current = {
    q: first(sp.q),
    year: first(sp.year),
    format: first(sp.format),
    category: first(sp.category),
  };

  const [replays, filters] = await Promise.all([getReplays(current), getReplayFilters()]);

  const formatLabels = Object.fromEntries(
    TALK_FORMATS.map((format) => [format, t(`format.${format}`)]),
  );

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/replays` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl font-bold text-noir lg:text-[64px] lg:leading-[120%]">
          {t("heading")}
        </h1>
        <p className="mt-4 max-w-[720px] text-gris">{t("intro", { count: filters.total })}</p>

        <div className="mt-8">
          <ReplayFiltersBar
            filters={filters}
            locale={locale}
            current={current}
            labels={{
              search: t("filters.search"),
              searchPlaceholder: t("filters.searchPlaceholder"),
              year: t("filters.year"),
              format: t("filters.format"),
              category: t("filters.category"),
              all: t("filters.all"),
              submit: t("filters.submit"),
              reset: t("filters.reset"),
              formatLabels,
            }}
          />
        </div>

        {replays.length > 0 ? (
          <>
            <p className="mt-6 text-sm text-gris" aria-live="polite">
              {t("results", { count: replays.length })}
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {replays.map((replay) => (
                <ReplayCard
                  key={`${replay.year}-${replay.slug}`}
                  replay={replay}
                  locale={locale}
                  current={current}
                  labels={{
                    watch: t("watch"),
                    filterBy: t("filterBy", { value: "{value}" }),
                    languageLabels: { fr: t("language.fr"), en: t("language.en") },
                    formatLabels,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-3xl bg-blanc p-8 text-center shadow-card">
            <p className="text-gris">{filters.total === 0 ? t("empty") : t("noResults")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
