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
  if (pathname.startsWith("/admin") || pathname.startsWith("/edit/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
