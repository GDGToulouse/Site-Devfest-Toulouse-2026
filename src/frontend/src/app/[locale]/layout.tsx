import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import PlausibleProvider from "next-plausible";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LanguageSuggestionBanner from "@/components/LanguageSuggestionBanner";
import { EditionProvider } from "@/contexts/EditionContext";
import { getCurrentEdition, getSeoSettings } from "@/lib/api";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isProduction = BASE_URL === "https://devfesttoulouse.fr";
const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: "site" }),
    getSeoSettings(),
  ]);

  const ogImage = seoSettings.seo_og_image || "/images/og-default.png";

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      template: `%s — ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
    openGraph: {
      siteName: t("title"),
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImage],
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: "/fr",
        en: "/en",
        "x-default": "/fr",
      },
    },
    ...(!isProduction && {
      robots: { index: false, follow: false },
    }),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const edition = await getCurrentEdition();

  return (
    <>
      {plausibleSrc && <PlausibleProvider src={plausibleSrc} />}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-bleu focus:text-blanc focus:px-4 focus:py-2 focus:rounded-s"
      >
        {locale === "fr" ? "Aller au contenu" : "Skip to content"}
      </a>
      <NextIntlClientProvider>
        <LanguageSuggestionBanner />
        <EditionProvider edition={edition}>
          <Header />
          <main id="main-content" role="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </EditionProvider>
      </NextIntlClientProvider>
    </>
  );
}
