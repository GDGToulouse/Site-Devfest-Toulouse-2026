import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { getCurrentEdition, getEditionSchedule } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ProgrammeBrowser from "@/components/programme/ProgrammeBrowser";
import { parseFavourites, parseView } from "@/lib/favourites";
import type { TalkFormat } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("programme");
  const edition = await getCurrentEdition();
  const year = edition?.year ?? new Date().getFullYear();

  return {
    title: t("pageTitle"),
    description: t("description", { year }),
    alternates: {
      canonical: `/${locale}/programme`,
      languages: { fr: "/fr/programme", en: "/en/programme", "x-default": "/fr/programme" },
    },
  };
}

const TALK_FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"];

// The width every other page of the site reads at. The grid is the exception.
const READING_COLUMN = "mx-auto max-w-7xl";

export default async function ProgrammePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("programme");
  const tc = await getTranslations("conferences");
  const tf = await getTranslations("favourites");
  const tcal = await getTranslations("calendar");
  const edition = await getCurrentEdition();

  if (!edition) notFound();

  const schedule = await getEditionSchedule(edition.year);
  const hasSchedule = (schedule?.talks.length ?? 0) > 0 || (schedule?.entries.length ?? 0) > 0;

  const formatLabels = Object.fromEntries(
    TALK_FORMATS.map((format) => [format, tc(`format.${format}`)]),
  );

  // Read the selection from the URL on the server, so a bookmarked link renders
  // its selection before hydration rather than flashing the whole programme.
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/programme` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className={READING_COLUMN}>
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("heading", { year: edition.year })}
        </h1>

        {/* An edition with rooms but no session placed yet still lands here from
            a shared link: it says "soon" rather than 404, because a 404 cached
            for an hour outlives the state that caused it (#345). */}
        {hasSchedule ? (
          <p className="mt-4 text-lg text-gris">{t("intro")}</p>
        ) : (
          <div className="mt-8 rounded-3xl bg-blanc p-8 shadow-card">
            <h2 className="text-2xl font-bold text-noir lg:text-3xl">{t("comingSoonTitle")}</h2>
            <p className="mt-4 text-lg leading-relaxed text-gris">
              {t("comingSoonBody", { year: edition.year })}
            </p>
          </div>
        )}
      </div>

      {hasSchedule ? (
        <>
          {/* The grid leaves the reading column (#441): eight rooms inside
              max-w-7xl gave 130 px per column, and a wider screen changed
              nothing at all. Everything else on the page stays aligned with
              the rest of the site. */}
          <div className="mx-auto mt-8 max-w-[110rem]">
            <ProgrammeBrowser
              schedule={schedule!}
              locale={locale}
              formatLabels={formatLabels}
              labels={{
                timeColumn: t("timeColumn"),
                roomTba: t("roomTba"),
                viewLabel: tf("viewLabel"),
                viewAll: tf("viewAll"),
                viewMine: tf("viewMine"),
                viewMineOnly: tf("viewMineOnly"),
                favouriteAdd: tf("add"),
                favouriteRemove: tf("remove"),
                empty: tf("empty"),
                exportAll: tcal("exportAll"),
                exportMine: tcal("exportMine"),
              }}
              initialFavourites={parseFavourites(first(sp.fav))}
              initialView={parseView(first(sp.view))}
            />
          </div>

          <div className={READING_COLUMN}>
            {/* The searchable list is the other way in (#107) — the grid answers
                "when and where", the list answers "what is there on my topic". */}
            <Link
              href="/conferences"
              className="mt-8 inline-flex items-center gap-2 rounded-[12px] bg-bismarck px-4 py-2 text-sm font-bold text-blanc hover:bg-bismarck/90"
            >
              {t("allSessions")}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
