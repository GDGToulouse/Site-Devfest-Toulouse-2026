import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getHallOfFame } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import HallOfFameCard from "@/components/speakers/HallOfFameCard";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("hallOfFame");
  const people = await getHallOfFame();

  return {
    title: t("title"),
    description: t("description", { count: people.length }),
    ...(await pageMetadata(locale, "/hall-of-fame")),
  };
}

// Everyone who ever spoke at a DevFest Toulouse (#352). `/speakers` answers "who
// is speaking this year"; this page answers "who has ever spoken".
export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("hallOfFame");

  const sp = await searchParams;
  const rawYear = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;

  const people = await getHallOfFame();

  // Filtering happens on the payload we already hold — no second request. It
  // still goes through the URL rather than client state, like /replays (#102),
  // so a filtered view stays shareable and server-rendered.
  const shown = year ? people.filter((p) => p.years.includes(year)) : people;
  const years = [...new Set(people.flatMap((p) => p.years))].sort((a, b) => b - a);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/hall-of-fame` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-[1440px]">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-8 text-3xl font-bold text-noir lg:text-5xl">{t("heading")}</h1>
        <p className="mt-2 text-lg text-gris">{t("intro", { count: people.length })}</p>

        {years.length > 0 && (
          <nav aria-label={t("filterLabel")} className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/hall-of-fame"
              aria-current={year ? undefined : "true"}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                year ? "bg-blanc-casse text-gris hover:brightness-95" : "bg-bismarck text-blanc"
              }`}
            >
              {t("allYears")}
            </Link>
            {years.map((y) => (
              <Link
                key={y}
                href={`/hall-of-fame?year=${y}`}
                aria-current={year === y ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  year === y ? "bg-bismarck text-blanc" : "bg-blanc-casse text-gris hover:brightness-95"
                }`}
              >
                {y}
              </Link>
            ))}
          </nav>
        )}

        <p className="mt-4 text-sm text-gris">{t("countLabel", { count: shown.length })}</p>

        {shown.length === 0 ? (
          <p className="mt-8 text-gris">{t("empty")}</p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((person) => (
              <li key={person.slug}>
                <HallOfFameCard person={person} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
