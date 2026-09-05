import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import PlausibleProvider from "next-plausible";
import WebVitals from "@/components/WebVitals";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LanguageSuggestionBanner from "@/components/LanguageSuggestionBanner";
import { EditionProvider } from "@/contexts/EditionContext";
import {
  getCfpSettings,
  getCurrentEdition,
  getIdentitySettings,
  getPublishedPages,
  getSocialLinks,
} from "@/lib/api";
import { buildFaviconMetadata, getLogoUrl } from "@/lib/identity";
import { pageMetadata } from "@/lib/page-metadata";
import { jsonLdScript } from "@/lib/seo";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isProduction = BASE_URL === "https://devfesttoulouse.fr";
const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, identity] = await Promise.all([
    getTranslations({ locale, namespace: "site" }),
    getIdentitySettings(),
  ]);

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      template: `%s — ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
    icons: buildFaviconMetadata(identity),
    // The admin's `seo_og_image` is *not* read here. It is honoured inside
    // ./opengraph-image.tsx (#183), and that file convention wins over
    // `openGraph.images` anyway — while `twitter.images`, set from the same
    // setting, kept the raw upload. The two tags ended up on different URLs
    // (#384). Naming the setting in one place only is what keeps them equal.
    ...(await pageMetadata(locale, "")),
    twitter: { card: "summary_large_image" },
    // On non-production hosts (beta), keep the site out of Google without
    // killing social sharing: emit noindex *only for Googlebot* rather than a
    // global `robots` meta. facebookexternalhit / LinkedInBot respect the
    // global `robots` noindex and refuse to render an OG preview, so a global
    // noindex made the beta unshareable (#169). Scoping it to googleBot leaves
    // the page shareable while robots.txt (Disallow: /) still gates crawlers.
    ...(!isProduction && {
      robots: { googleBot: { index: false, follow: false } },
    }),
  };
}

// Malachite (#109E6E) — the brand's green identity colour (design-system.md).
// Colours the mobile browser toolbar and matches the web app manifest.
export const viewport: Viewport = {
  themeColor: "#109E6E",
};

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

  const [edition, cfp, identity, socialLinks, pages] = await Promise.all([
    getCurrentEdition(),
    getCfpSettings(),
    getIdentitySettings(),
    getSocialLinks(),
    getPublishedPages(),
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
      {plausibleSrc && (
        <>
          <PlausibleProvider src={plausibleSrc} />
          <WebVitals />
        </>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-bleu focus:text-blanc focus:px-4 focus:py-2 focus:rounded-s"
      >
        {locale === "fr" ? "Aller au contenu" : "Skip to content"}
      </a>
      <NextIntlClientProvider>
        <LanguageSuggestionBanner />
        <EditionProvider
          edition={edition}
          cfp={cfp}
          identity={identity}
          socialLinks={socialLinks}
          pages={pages}
        >
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
