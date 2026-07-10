import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getEditions } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("editionsList");
  return {
    title: t("pageTitle"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/editions`,
      languages: {
        fr: `/fr/editions`,
        en: `/en/editions`,
        "x-default": `/fr/editions`,
      },
    },
  };
}

export default async function EditionsListPage() {
  const locale = await getLocale();
  const t = await getTranslations("editionsList");

  // Past editions only (the upcoming one has its own home page).
  const editions = (await getEditions())
    .filter((e) => e.status === "SEE_YOU_NEXT_YEAR")
    .sort((a, b) => b.year - a.year);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle"), href: `/${locale}/editions` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-5xl font-bold text-noir">{t("pageTitle")}</h1>
        <p className="mt-3 text-lg text-gris">{t("description")}</p>

        {editions.length === 0 ? (
          <p className="mt-12 text-gris">{t("empty")}</p>
        ) : (
          <ul className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {editions.map((e) => (
              <li key={e.year}>
                <Link
                  href={`/editions/${e.year}`}
                  className="group flex aspect-square flex-col items-center justify-center rounded-2xl bg-blanc shadow-card hover:shadow-lg transition-shadow"
                >
                  <span className="text-4xl lg:text-5xl font-bold text-malachite group-hover:scale-105 transition-transform">
                    {e.year}
                  </span>
                  <span className="mt-2 text-sm text-gris">DevFest Toulouse</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
