import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV === "development";

const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "";
const plausibleOrigin = plausibleSrc ? new URL(plausibleSrc).origin : "";

const nextConfig: NextConfig = {
  // The backend accepts up to 20 MB per upload (see admin/files.ts).
  // Next.js' default of 10 MB on proxied bodies would silently truncate
  // multipart payloads and break image uploads — bump it past 20 MB plus
  // the multipart envelope overhead.
  experimental: {
    proxyClientMaxBodySize: 25 * 1024 * 1024, // 25 MB
  },
  async redirects() {
    return [
      // Legacy route: the former /partners page is now /sponsors. Keep a
      // permanent redirect so external links and crawled results don't 404.
      {
        source: "/:locale(fr|en)/partners",
        destination: "/:locale/sponsors",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/api/admin/:path*`,
      },
      {
        source: "/api/auth/:path*",
        destination: `${backendUrl}/api/auth/:path*`,
      },
      {
        source: "/api/contact/:path*",
        destination: `${backendUrl}/api/contact/:path*`,
      },
      {
        source: "/api/brochure/:token",
        destination: `${backendUrl}/api/brochure/:token`,
      },
      {
        // :path* (not :token) so the sub-route /api/edit/:token/upload (#241)
        // also proxies to the backend, not only the bare /api/edit/:token.
        source: "/api/edit/:path*",
        destination: `${backendUrl}/api/edit/:path*`,
      },
      {
        source: "/api/editions/:path*",
        destination: `${backendUrl}/api/editions/:path*`,
      },
      {
        source: "/api/speakers/:path*",
        destination: `${backendUrl}/api/speakers/:path*`,
      },
      {
        source: "/api/sponsors/:path*",
        destination: `${backendUrl}/api/sponsors/:path*`,
      },
      {
        source: "/api/talks/:path*",
        destination: `${backendUrl}/api/talks/:path*`,
      },
      {
        source: "/api/replays/:path*",
        destination: `${backendUrl}/api/replays/:path*`,
      },
      {
        source: "/api/replays",
        destination: `${backendUrl}/api/replays`,
      },
      {
        source: "/api/me/:path*",
        destination: `${backendUrl}/api/me/:path*`,
      },
      {
        // The trash purge is triggered from the back-office (#335). Without
        // this rewrite the browser hits Next.js instead of the API and gets a
        // 404 HTML page, since maintenance routes sit under /api, not /api/admin.
        source: "/api/maintenance/:path*",
        destination: `${backendUrl}/api/maintenance/:path*`,
      },
      {
        source: "/api/health",
        destination: `${backendUrl}/api/health`,
      },
      {
        source: "/api/docs",
        destination: `${backendUrl}/api/docs/`,
      },
      {
        source: "/api/docs/:path*",
        destination: `${backendUrl}/api/docs/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      // Cache-Control: admin pages — no cache (admin is not i18n-prefixed)
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      // Cache-Control: homepage — short cache (5 min)
      {
        source: "/:locale(fr|en)",
        headers: [
          { key: "Cache-Control", value: "s-maxage=300, stale-while-revalidate=60" },
        ],
      },
      // Cache-Control: all other public pages — 1 hour.
      //
      // `headers()` matches on path only: it cannot tell a rendered page from a
      // failed one, so a 500 leaves with this header too. Harmless as things
      // stand — `s-maxage` addresses shared caches, browsers ignore it, and
      // Traefik does not cache in front of us (verified: no `age`/`x-cache` on
      // production responses). Next re-renders the page as soon as the backend
      // answers again, so recovery is immediate (#345).
      //
      // Putting a CDN in front would change that: the error would then be
      // cached for an hour. Serve 5xx with `no-store` at that layer.
      {
        source: "/:locale(fr|en)/:path+",
        headers: [
          { key: "Cache-Control", value: "s-maxage=3600, stale-while-revalidate=60" },
        ],
      },
      // Security headers on all pages
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${plausibleOrigin ? ` ${plausibleOrigin}` : ""}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // blob: is required by the admin image picker (#371): the preview
              // shown before upload is a URL.createObjectURL() of the local
              // file, which is a blob: URL. Without it the CSP blocks the
              // preview and the admin sees a broken image. Same-origin and
              // short-lived — it only ever points at bytes the page already has.
              "img-src 'self' data: blob: https:",
              `connect-src 'self'${isDev ? " http://localhost:4000 ws://localhost:3000" : ""}${plausibleOrigin ? ` ${plausibleOrigin}` : ""}`,
              "frame-src https://www.youtube.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      { pathname: "/images/**" },
      { pathname: "/uploads/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
