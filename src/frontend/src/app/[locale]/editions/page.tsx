import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getEditions } from "@/lib/api";
import { buildTimeline } from "@/lib/edition-timeline";
import { formatEventDate } from "@/lib/datetime";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("editionsList");
  return {
    title: t("pageTitle"),
    description: t("description"),
    ...(await pageMetadata(locale, "/editions")),
  };
}

export default async function EditionsListPage() {
  const locale = await getLocale();
  const t = await getTranslations("editionsList");

  // A timeline rather than a grid of years (#104): the coming edition on top,
  // every past one with its date and venue, and the years without a DevFest.
  const steps = buildTimeline(await getEditions());

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

        {steps.length === 0 ? (
          <p className="mt-12 text-gris">{t("empty")}</p>
        ) : (
          <ol className="relative mt-10 ml-3 max-w-2xl space-y-6 border-l-2 border-malachite/30">
            {steps.map((step) =>
              step.type === "gap" ? (
                <li key={`gap-${step.from}`} className="relative pl-8">
                  <span aria-hidden className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-gris/40 bg-blanc-casse" />
                  <p className="text-base italic text-gris">{step.from === step.to ? t("gapYear", { year: step.from }) : t("gap", { from: step.from, to: step.to })}</p>
                </li>
              ) : (
                <li key={step.year} className="relative pl-8">
                  <span
                    aria-hidden
                    className={`absolute -left-[11px] top-6 h-5 w-5 rounded-full border-4 border-blanc-casse ${
                      step.isUpcoming ? "bg-terre-cuite" : "bg-malachite"
                    }`}
                  />
                  {/* The coming edition has its own page: the home page. */}
                  <Link
                    href={step.isUpcoming ? "/" : `/editions/${step.year}`}
                    className="group block rounded-2xl bg-blanc p-5 shadow-card transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`text-3xl font-bold lg:text-4xl ${step.isUpcoming ? "text-terre-cuite" : "text-malachite"}`}>
                        {step.year}
                      </span>
                      {(step.isUpcoming || step.isFirst) && (
                        <span className="rounded-full bg-blanc-casse px-3 py-0.5 text-sm font-bold text-noir">
                          {step.isUpcoming ? t("upcoming") : t("first")}
                        </span>
                      )}
                    </span>
                    {(step.startDate || step.venueName) && (
                      <span className="mt-2 block text-base text-gris">
                        {[step.startDate && formatEventDate(step.startDate, locale), step.venueName].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </Link>
                </li>
              ),
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
