import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getSponsorPlans, getKeyFigures } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

function localizedField(
  obj: Record<string, unknown>,
  field: string,
  locale: string,
): string {
  const key = locale === "en" ? `${field}En` : `${field}Fr`;
  return (obj[key] as string) || "";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("sponsor");
  return {
    title: t("pageTitle"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/devenir-sponsor`,
      languages: { fr: "/fr/devenir-sponsor", en: "/en/devenir-sponsor" },
    },
  };
}

export default async function SponsorPage() {
  const locale = await getLocale();
  const t = await getTranslations("sponsor");
  const [edition, plans, keyFigures] = await Promise.all([
    getCurrentEdition(),
    getSponsorPlans(),
    getKeyFigures(),
  ]);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle"), href: `/${locale}/devenir-sponsor` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("pageTitle")}
        </h1>

        <p className="mt-6 text-lg text-gris leading-relaxed max-w-3xl">
          {t("intro")}
        </p>

        {/* Key figures — reuse from homepage */}
        {keyFigures.length > 0 && (
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {keyFigures.map((fig) => (
              <div
                key={fig.value + fig.labelFr}
                className="text-center p-6 rounded-xl bg-blanc-casse"
              >
                <p className="text-3xl font-bold text-malachite">{fig.value}</p>
                <p className="mt-1 text-sm text-gris">
                  {locale === "en" ? fig.labelEn : fig.labelFr}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Why become a sponsor */}
        <div className="mt-16">
          <h2 className="text-2xl lg:text-4xl font-bold text-noir">
            {t("whyTitle")}
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {(["Visibility", "Brand", "Products", "Network"] as const).map(
              (key) => (
                <div
                  key={key}
                  className="p-6 rounded-xl bg-blanc shadow-card"
                >
                  <p className="text-lg font-bold text-noir">
                    {t(`why${key}`)}
                  </p>
                  <p className="mt-2 text-sm text-gris leading-relaxed">
                    {t(`why${key}Desc`)}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Sponsor plans */}
        <div className="mt-16">
          <h2 className="text-2xl lg:text-4xl font-bold text-noir">
            {t("plansTitle")}
          </h2>

          {plans.length === 0 ? (
            <p className="mt-6 text-gris">{t("noPlans")}</p>
          ) : (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const name = localizedField(plan as unknown as Record<string, unknown>, "name", locale);
                const subtitle = localizedField(plan as unknown as Record<string, unknown>, "subtitle", locale);
                const description = localizedField(plan as unknown as Record<string, unknown>, "description", locale);
                const advantages = plan.advantages || [];

                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl overflow-hidden bg-blanc shadow-card flex flex-col"
                  >
                    {/* Color header */}
                    <div
                      className="px-6 py-4"
                      style={{ backgroundColor: plan.color }}
                    >
                      <p className="text-xl font-bold text-blanc">{name}</p>
                      {subtitle && (
                        <p className="text-sm text-blanc/80 italic">{subtitle}</p>
                      )}
                    </div>

                    <div className="p-6 flex-1 flex flex-col">
                      {plan.price && (
                        <p className="text-2xl font-bold text-noir mb-2">
                          {plan.price}
                        </p>
                      )}

                      {plan.standSize && (
                        <p className="text-sm text-gris mb-4">
                          {t("standSize", { size: plan.standSize })}
                        </p>
                      )}

                      {description && (
                        <p className="text-sm text-gris leading-relaxed mb-4">
                          {description}
                        </p>
                      )}

                      {advantages.length > 0 && (
                        <div className="mt-auto">
                          <p className="text-sm font-bold text-noir mb-2">
                            {t("advantages")}
                          </p>
                          <ul className="space-y-1">
                            {advantages.map(
                              (adv: { fr: string; en: string }, i: number) => (
                                <li
                                  key={i}
                                  className="text-sm text-gris flex items-start gap-2"
                                >
                                  <span
                                    className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: plan.color }}
                                  />
                                  {locale === "en" ? adv.en : adv.fr}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          {edition?.partnerFormUrl ? (
            <a
              href={edition.partnerFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 rounded-[12px] bg-bleu text-blanc font-bold text-xl hover:bg-bleu/90 transition-colors"
            >
              {t("ctaDownload")}
            </a>
          ) : (
            <Link
              href="/contact"
              className="inline-block px-8 py-4 rounded-[12px] bg-bleu text-blanc font-bold text-xl hover:bg-bleu/90 transition-colors"
            >
              {t("ctaContact")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
