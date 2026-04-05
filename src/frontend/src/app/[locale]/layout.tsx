import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Google_Sans } from "next/font/google";
import { routing } from "@/i18n/routing";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LanguageSuggestionBanner from "@/components/LanguageSuggestionBanner";
import { EditionProvider } from "@/contexts/EditionContext";
import { getCurrentEdition } from "@/lib/api";

const googleSans = Google_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-google-sans",
});

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isProduction = BASE_URL === "https://devfesttoulouse.fr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });

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
          url: "/images/og-default.png",
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/images/og-default.png"],
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: "/fr",
        en: "/en",
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
    <html lang={locale} className={`h-full antialiased ${googleSans.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
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
      </body>
    </html>
  );
}
