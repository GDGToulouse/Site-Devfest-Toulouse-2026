import { headers } from "next/headers";
import { Google_Sans } from "next/font/google";
import { routing } from "@/i18n/routing";
import "./globals.css";

// `optional`, not `swap` (#481). next/font normally hides a font swap by
// emitting a fallback face with matching metrics, but it has none for Google
// Sans — the build says so out loud ("Failed to find font override values for
// font `Google Sans`. Skipping generating a fallback font."), and the built CSS
// carries no size-adjust/ascent-override rule to prove it. So `swap` replaced
// system-ui with a font of different metrics after first paint, and every line
// of the hero changed height: PageSpeed put the page's whole 0.063 CLS on
// `section.hero`, a 412 × 947 block — the entire first screen.
//
// With `optional` the browser takes the font if it is ready within its ~100 ms
// window and otherwise keeps the fallback for that page load, never swapping.
// The trade is that a first visit on a slow link may render in system-ui; the
// alternative, a hand-measured metric-matched fallback, keeps the brand font on
// those loads too and is the move if this trade reads wrong.
const googleSans = Google_Sans({
  subsets: ["latin"],
  display: "optional",
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
