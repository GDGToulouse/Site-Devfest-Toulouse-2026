import { headers } from "next/headers";
import { Google_Sans } from "next/font/google";
import { routing } from "@/i18n/routing";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-google-sans",
});

// Root layout must render per-request so <html lang> reflects the locale
// resolved by the next-intl middleware.
export const dynamic = "force-dynamic";

// The next-intl middleware forwards the resolved locale through the
// X-NEXT-INTL-LOCALE request header (see next-intl source: shared/constants.js
// exports HEADER_LOCALE_NAME = "X-NEXT-INTL-LOCALE"). Admin routes are
// excluded from the middleware and therefore lack this header; they fall back
// to the default locale.
async function resolveLang(): Promise<string> {
  const headerList = await headers();
  const fromMiddleware = headerList.get("x-next-intl-locale");
  if (fromMiddleware && (routing.locales as readonly string[]).includes(fromMiddleware)) {
    return fromMiddleware;
  }
  // Fallback: look at NEXT_LOCALE cookie if present.
  const cookie = headerList.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  if (match && (routing.locales as readonly string[]).includes(match[1])) {
    return match[1];
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
