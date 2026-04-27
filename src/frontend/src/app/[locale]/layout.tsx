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
import { getCfpSettings, getCurrentEdition, getIdentitySettings, getSeoSettings, getSocialLinks } from "@/lib/api";
import { buildFaviconMetadata, getLogoUrl } from "@/lib/identity";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isProduction = BASE_URL === "https://devfesttoulouse.fr";
const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, seoSettings, identity] = await Promise.all([
    getTranslations({ locale, namespace: "site" }),
    getSeoSettings(),
    getIdentitySettings(),
  ]);

  // If the admin configured a static OG image override, honour it. Otherwise
  // let Next.js pick up the per-route opengraph-image.tsx convention, which
  // generates branded images at request time.
  const ogImageOverride = seoSettings.seo_og_image || null;

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      template: `%s — ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
    icons: buildFaviconMetadata(identity),
    openGraph: {
      siteName: t("title"),
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      ...(ogImageOverride && {
        images: [
          {
            url: ogImageOverride,
            width: 1200,
            height: 630,
            alt: t("title"),
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      ...(ogImageOverride && { images: [ogImageOverride] }),
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

  const [edition, cfp, identity, socialLinks] = await Promise.all([
    getCurrentEdition(),
    getCfpSettings(),
    getIdentitySettings(),
    getSocialLinks(),
  ]);

  const logoPath = getLogoUrl(identity, "square");
  const logoUrl = /^https?:\/\//.test(logoPath) ? logoPath : `${BASE_URL}${logoPath}`;

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "DevFest Toulouse",
    alternateName: "DevFest Toulouse by GDG Toulouse",
    url: BASE_URL,
    logo: logoUrl,
    sameAs: [
      socialLinks.social_linkedin,
      socialLinks.social_youtube,
      socialLinks.social_x,
      socialLinks.social_bluesky,
      "https://gdg.community.dev/gdg-toulouse/",
    ].filter((url): url is string => Boolean(url)),
    parentOrganization: {
      "@type": "Organization",
      name: "GDG Toulouse",
      url: "https://gdg.community.dev/gdg-toulouse/",
    },
  };

  return (
    <>
      {plausibleSrc && <PlausibleProvider src={plausibleSrc} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-bleu focus:text-blanc focus:px-4 focus:py-2 focus:rounded-s"
      >
        {locale === "fr" ? "Aller au contenu" : "Skip to content"}
      </a>
      <NextIntlClientProvider>
        <LanguageSuggestionBanner />
        <EditionProvider edition={edition} cfp={cfp} identity={identity} socialLinks={socialLinks}>
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
