import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("sponsors");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/sponsors`,
      languages: { fr: "/fr/sponsors", en: "/en/sponsors", "x-default": "/fr/sponsors" },
    },
  };
}

export default async function SponsorsPage() {
  const locale = await getLocale();
  const t = await getTranslations("sponsors");
  const edition = await getCurrentEdition();
  const year = edition?.year ?? new Date().getFullYear();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/sponsors` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("heading", { year })}
        </h1>

        <div className="mt-8 p-8 rounded-3xl bg-blanc shadow-card">
          <h2 className="text-2xl lg:text-3xl font-bold text-noir">
            {t("comingSoonTitle")}
          </h2>
          <p className="mt-4 text-lg text-gris leading-relaxed">
            {t("comingSoonBody", { year })}
          </p>
          <Link
            href="/devenir-sponsor"
            className="mt-6 inline-block px-6 py-3 rounded-[12px] bg-bleu text-blanc font-bold hover:bg-bleu/90 transition-colors"
          >
            {t("becomeSponsorCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
