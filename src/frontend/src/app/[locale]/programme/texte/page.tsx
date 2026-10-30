import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { getCurrentEdition, getEditionSchedule } from "@/lib/api";
import ProgrammeText from "@/components/programme/ProgrammeText";
import type { TalkFormat, TalkLevel } from "@/lib/types";

// The plain view of the programme (#755), for partners: shared by link from the
// admin dashboard, kept out of search engines and of the site menu. Not
// protected — it shows nothing the programme page does not.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("programmeText");
  return {
    title: t("pageTitle"),
    robots: { index: false, follow: false },
  };
}

const TALK_FORMATS: TalkFormat[] = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"];
const TALK_LEVELS: TalkLevel[] = ["DEBUTANT", "INTERMEDIAIRE", "CONFIRME"];

export default async function ProgrammeTextPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("programmeText");
  const tp = await getTranslations("programme");
  const tc = await getTranslations("conferences");
  const edition = await getCurrentEdition();

  if (!edition) notFound();

  const schedule = await getEditionSchedule(edition.year);
  const hasSchedule = (schedule?.talks.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold text-noir">{t("heading", { year: edition.year })}</h1>
      <p className="no-print mt-2 text-gris">{t("intro")}</p>

      <div className="mt-6">
        {hasSchedule ? (
          <ProgrammeText
            schedule={schedule!}
            locale={locale}
            labels={{
              formatLabels: Object.fromEntries(TALK_FORMATS.map((f) => [f, tc(`format.${f}`)])),
              levelLabels: Object.fromEntries(TALK_LEVELS.map((l) => [l, tc(`level.${l}`)])),
              languageLabels: { fr: tc("filters.langFr"), en: tc("filters.langEn") },
              simulcast: tp("simulcast"),
              roomTba: tp("roomTba"),
              common: tp("printCommon"),
              settings: t("settings"),
              settingsTitle: t("settingsTitle"),
              fieldLabels: {
                time: t("fields.time"),
                format: t("fields.format"),
                category: t("fields.category"),
                language: t("fields.language"),
                level: t("fields.level"),
                notes: t("fields.notes"),
              },
              grouping: t("grouping"),
              byRoom: t("byRoom"),
              byTime: t("byTime"),
              room: t("room"),
              allRooms: t("allRooms"),
              copy: t("copy"),
              copyTitle: t("copyTitle"),
              copied: t("copied"),
              copyFailed: t("copyFailed"),
              notes: t("fields.notes"),
            }}
          />
        ) : (
          <p className="text-gris">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
