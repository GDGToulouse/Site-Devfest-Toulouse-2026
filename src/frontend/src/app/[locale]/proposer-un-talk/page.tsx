import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCfpSettings } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cfp");
  return {
    title: t("pageTitle"),
    description: t("description"),
  };
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function CfpPage() {
  const locale = await getLocale();
  const t = await getTranslations("cfp");
  const cfp = await getCfpSettings();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle"), href: `/${locale}/proposer-un-talk` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("pageTitle")}
        </h1>

        <p className="mt-6 text-lg text-gris leading-relaxed">
          {t("intro")}
        </p>

        {/* CFP Status */}
        <div className="mt-8 p-6 rounded-3xl bg-blanc shadow-card">
          {cfp.isOpen ? (
            <>
              <p className="text-lg font-bold text-malachite">
                {t("statusOpen")}
              </p>
              {cfp.openDate && cfp.closeDate && (
                <p className="mt-2 text-gris">
                  {t("dates", {
                    open: formatDate(cfp.openDate, locale),
                    close: formatDate(cfp.closeDate, locale),
                  })}
                </p>
              )}
              {cfp.sessionizeUrl && (
                <a
                  href={cfp.sessionizeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-block px-8 py-4 rounded-s bg-bleu text-blanc font-bold text-xl hover:bg-bleu/90 transition-colors"
                >
                  {t("ctaSubmit")}
                </a>
              )}
            </>
          ) : (
            <p className="text-lg font-bold text-terre-cuite">
              {t("statusClosed")}
            </p>
          )}
        </div>

        {/* Accepted Formats */}
        <div className="mt-12">
          <h2 className="text-2xl lg:text-4xl font-bold text-noir">
            {t("formatsTitle")}
          </h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {(["conference", "quickie", "keynote"] as const).map((format) => (
              <div
                key={format}
                className="p-6 rounded-xl bg-blanc-casse text-center"
              >
                <p className="text-lg font-bold text-noir">{t(`formats.${format}`)}</p>
                <p className="mt-1 text-sm text-gris">{t(`formats.${format}Duration`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Topics */}
        <div className="mt-12">
          <h2 className="text-2xl lg:text-4xl font-bold text-noir">
            {t("topicsTitle")}
          </h2>
          <p className="mt-4 text-gris leading-relaxed">
            {t("topicsDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
