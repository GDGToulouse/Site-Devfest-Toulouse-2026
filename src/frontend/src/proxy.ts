import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const SOCIAL_CARD_PATH = /^\/(speakers|sponsors|conferences)\/[^/]+\/social-card$/;

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin and the token-based edit pages are mono-language: bypass i18n routing.
  // Their <html lang> is fixed by the (app) root layout, not read from the request.
  // /sponsor and /sponsor/* joined them in #362: a sponsor's own space is an
  // application screen, not a page of the public site. Without this, next-intl
  // rewrites it to /fr/sponsor and every link 404s.
  //
  // Matched exactly, NOT by prefix: the public wall lives at /sponsors, one
  // letter away, and must keep going through i18n routing.
  const isSponsorSpace = pathname === "/sponsor" || pathname.startsWith("/sponsor/");
  // /connect (#514): where an AI agent sends a person to sign in. Its URL is
  // configured in the OAuth provider and must not gain a locale prefix.
  const isAgentConnect = pathname === "/connect" || pathname.startsWith("/connect/");
  // /arrivees (#640): the volunteers' event-day zone, French only.
  const isArrivalsZone = pathname === "/arrivees" || pathname.startsWith("/arrivees/");
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/edit/") ||
    isSponsorSpace ||
    isAgentConnect ||
    isArrivalsZone
  ) {
    return NextResponse.next();
  }

  // Locale-agnostic image route handlers, the social cards of speakers
  // (US-250), sponsors and talks (#116): they render a PNG and must not be
  // rewritten through i18n routing.
  if (SOCIAL_CARD_PATH.test(pathname)) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
