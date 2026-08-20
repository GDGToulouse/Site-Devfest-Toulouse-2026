import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin is mono-language: bypass i18n routing but forward the pathname
  // through request headers so the root layout can pin <html lang> to the
  // default locale (and ignore any NEXT_LOCALE cookie from a previous
  // visit to a public page).
  // Admin and the token-based edit pages are mono-language: bypass i18n routing
  // but forward the pathname so the root layout can pin <html lang>.
  // /sponsor and /sponsor/* joined them in #362: a sponsor's own space is an
  // application screen, not a page of the public site. Without this, next-intl
  // rewrites it to /fr/sponsor and every link 404s.
  //
  // Matched exactly, NOT by prefix: the public wall lives at /sponsors, one
  // letter away, and must keep going through i18n routing.
  const isSponsorSpace = pathname === "/sponsor" || pathname.startsWith("/sponsor/");
  if (pathname.startsWith("/admin") || pathname.startsWith("/edit/") || isSponsorSpace) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Locale-agnostic image route handlers (e.g. speaker social cards, US-250):
  // these render a PNG and must not be rewritten through i18n routing.
  if (pathname.startsWith("/speakers/") && pathname.endsWith("/social-card")) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
