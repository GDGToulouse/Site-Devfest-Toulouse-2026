import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getSponsorPlans, getContactCategories } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ContactForm from "@/components/ContactForm";
import { Link } from "@/i18n/navigation";
import type { SponsorPageStatus } from "@/lib/types";

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
      languages: { fr: "/fr/devenir-sponsor", en: "/en/devenir-sponsor", "x-default": "/fr/devenir-sponsor" },
    },
  };
}

export default async function SponsorPage() {
  const locale = await getLocale();
  const t = await getTranslations("sponsor");
  const [edition, plans, categories] = await Promise.all([
    getCurrentEdition(),
    getSponsorPlans(),
    getContactCategories(),
  ]);

  // The dedicated brochure-request category triggers the email template
  // with the tracked {brochureUrl} link. We fall back to the legacy
  // "sponsoring" slug for environments where the seed hasn't run yet.
  const sponsoringCategory =
    categories.find((c) => c.slug === "sponsor-brochure") ??
    categories.find((c) => c.slug === "sponsoring");

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle"), href: `/${locale}/devenir-sponsor` },
  ];

  const heroImageUrl = edition?.heroImageUrl || null;
  const status: SponsorPageStatus = edition?.sponsorPageStatus ?? "PRE_ANNOUNCEMENT";
  const tempUrl = edition?.sponsorTemporaryFormUrl || null;

  // Sections to render depending on status:
  // - "why" block always shown (gives context regardless of mode)
  // - plans + brochure + integrated form: OPEN only
  // - plans (without brochure/form, with external CTA): TEMPORARY
  // - external CTA only: PRE_ANNOUNCEMENT
  // - sold-out message: SOLD_OUT
  const showPlans = status === "OPEN" || status === "TEMPORARY";
  const showIntegratedForm = status === "OPEN" && Boolean(sponsoringCategory);
  const showTemporaryCta = (status === "PRE_ANNOUNCEMENT" || status === "TEMPORARY") && Boolean(tempUrl);
  const showSoldOut = status === "SOLD_OUT";
  const showPreAnnouncementMessage = status === "PRE_ANNOUNCEMENT";

  return (
    <div>
      {/* Hero image */}
      {heroImageUrl && (
        <div
          className="relative w-full h-[300px] lg:h-[400px] bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(0deg, rgba(29,29,27,0.4), rgba(29,29,27,0.2)), url('${heroImageUrl}')`,
          }}
        >
          <div className="absolute inset-0 flex items-end">
            <div className="mx-auto w-full max-w-6xl px-6 pb-8">
              <h1 className="text-4xl lg:text-[64px] lg:leading-[120%] font-bold text-blanc drop-shadow-lg">
                {t("pageTitle")}
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-8 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <Breadcrumb items={breadcrumbItems} />

          {/* Title if no hero */}
          {!heroImageUrl && (
            <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
              {t("pageTitle")}
            </h1>
          )}

          <p className="mt-6 text-lg text-gris leading-relaxed max-w-3xl">
            {t("intro")}
          </p>

          {/* Sold-out callout — short and ends the page */}
          {showSoldOut && (
            <div className="mt-12 p-8 rounded-xl bg-blanc shadow-card max-w-3xl">
              <h2 className="text-2xl lg:text-3xl font-bold text-noir">
                {t("soldOutTitle")}
              </h2>
              <p className="mt-4 text-gris leading-relaxed">
                {t("soldOutMessage")}
              </p>
              <Link
                href="/contact"
                className="mt-6 inline-block px-6 py-3 rounded-[12px] bg-bleu text-blanc font-bold hover:bg-bleu/90 transition-colors"
              >
                {t("soldOutCta")}
              </Link>
            </div>
          )}

          {/* Why become a sponsor — shown unless sold out */}
          {!showSoldOut && (
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
          )}

          {/* Pre-announcement message */}
          {showPreAnnouncementMessage && (
            <div className="mt-16 p-8 rounded-xl bg-blanc shadow-card max-w-3xl">
              <h2 className="text-2xl lg:text-3xl font-bold text-noir">
                {t("preAnnouncementTitle")}
              </h2>
              <p className="mt-4 text-gris leading-relaxed">
                {t("preAnnouncementMessage")}
              </p>
              {showTemporaryCta && tempUrl && (
                <a
                  href={tempUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-block px-6 py-3 rounded-[12px] bg-bleu text-blanc font-bold hover:bg-bleu/90 transition-colors"
                >
                  {t("preAnnouncementCta")}
                </a>
              )}
            </div>
          )}

          {/* Sponsor plans */}
          {showPlans && (
            <div className="mt-16">
              <h2 className="text-2xl lg:text-4xl font-bold text-noir">
                {t("plansTitle")}
              </h2>

              {plans.length === 0 ? (
                <p className="mt-6 text-gris">{t("noPlans")}</p>
              ) : (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
                  {plans.map((plan) => {
                    const name = localizedField(plan as unknown as Record<string, unknown>, "name", locale);
                    const subtitle = localizedField(plan as unknown as Record<string, unknown>, "subtitle", locale);
                    const advantages = plan.advantages || [];

                    // CTA target depends on the page mode
                    const planCtaHref = status === "OPEN" ? "#contact" : (tempUrl || "#contact");
                    const planCtaExternal = status !== "OPEN" && Boolean(tempUrl);

                    return (
                      <div
                        key={plan.id}
                        className={`relative flex flex-col border border-gris/20 bg-blanc ${
                          plan.isFeatured
                            ? "lg:-my-4 lg:shadow-xl lg:z-10 lg:scale-[1.03] rounded-2xl"
                            : "first:rounded-l-2xl last:rounded-r-2xl"
                        }`}
                      >
                        {/* Color header */}
                        <div
                          className={`px-6 py-4 text-center ${
                            plan.isFeatured ? "rounded-t-2xl py-5" : "first:rounded-tl-2xl last:rounded-tr-2xl"
                          }`}
                          style={{ backgroundColor: plan.color }}
                        >
                          <p className={`font-bold text-blanc ${plan.isFeatured ? "text-2xl" : "text-xl"}`}>
                            {name}
                          </p>
                        </div>

                        {/* Subtitle */}
                        {subtitle && (
                          <p className="text-center text-sm text-gris italic px-4 pt-4">
                            {subtitle}
                          </p>
                        )}

                        {/* Stand size */}
                        {plan.standSize && (
                          <p className="text-center text-3xl lg:text-4xl font-bold px-4 pt-4" style={{ color: plan.color }}>
                            {plan.standSize}
                          </p>
                        )}

                        {!plan.standSize && (
                          <p className="text-center text-lg font-bold text-gris/50 px-4 pt-6">
                            —
                          </p>
                        )}

                        {/* Advantages */}
                        <div className="flex-1 px-6 py-6">
                          <ul className="space-y-3">
                            {advantages.map(
                              (adv: { fr: string; en: string }, i: number) => (
                                <li
                                  key={i}
                                  className="text-sm text-noir text-center"
                                >
                                  {locale === "en" ? adv.en : adv.fr}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>

                        {/* CTA button */}
                        <div className="px-6 pb-6">
                          <a
                            href={planCtaHref}
                            {...(planCtaExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                            className="block w-full text-center py-3 rounded-lg font-bold text-blanc transition-opacity hover:opacity-90"
                            style={{ backgroundColor: plan.color }}
                          >
                            {t("ctaContact")}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Temporary CTA below plans (TEMPORARY mode) */}
          {status === "TEMPORARY" && showTemporaryCta && tempUrl && (
            <div className="mt-16 text-center">
              <a
                href={tempUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-4 rounded-[12px] bg-bleu text-blanc font-bold text-xl hover:bg-bleu/90 transition-colors"
              >
                {t("temporaryCta")}
              </a>
            </div>
          )}

          {/* Integrated contact form (OPEN mode only) */}
          {showIntegratedForm && sponsoringCategory && (
            <div id="contact" className="mt-16 scroll-mt-8">
              <h2 className="text-2xl lg:text-4xl font-bold text-noir">
                {t("formTitle")}
              </h2>
              <p className="mt-4 text-gris leading-relaxed max-w-3xl">
                {t("formIntro")}
              </p>
              <div className="mt-8 max-w-2xl">
                <ContactForm
                  categories={categories}
                  locale={locale}
                  forceCategoryId={sponsoringCategory.id}
                  submitLabel={t("formSubmit")}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
