import { headers } from "next/headers";
import { Google_Sans } from "next/font/google";
import { routing } from "@/i18n/routing";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-google-sans",
});

// The next-intl middleware forwards the resolved locale through the
// X-NEXT-INTL-LOCALE request header (see next-intl source: shared/constants.js
// exports HEADER_LOCALE_NAME = "X-NEXT-INTL-LOCALE"). Admin routes are
// excluded from the middleware and are always served in the default locale
// (the admin back-office is mono-language).
async function resolveLang(): Promise<string> {
  const headerList = await headers();

  // Admin is always in the default locale, ignoring any lingering NEXT_LOCALE
  // cookie from a previous visit to a public page.
  const path = headerList.get("x-pathname") || "";
  if (path.startsWith("/admin")) {
    return routing.defaultLocale;
  }

  const fromMiddleware = headerList.get("x-next-intl-locale");
  if (fromMiddleware && (routing.locales as readonly string[]).includes(fromMiddleware)) {
    return fromMiddleware;
  }
  return routing.defaultLocale;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await resolveLang();

  return (
    <html lang={lang} className={`h-full antialiased ${googleSans.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
