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
        source: "/api/edit/:token",
        destination: `${backendUrl}/api/edit/:token`,
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
        source: "/api/me/:path*",
        destination: `${backendUrl}/api/me/:path*`,
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
      // Cache-Control: all other public pages — 1 hour
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
              "img-src 'self' data: https:",
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
