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
      // The WordPress programme URL, still linked from the GDG Toulouse page
      // (#386). The infra redirects of #380 don't cover it, and without a
      // locale it would get /fr prepended and 404.
      {
        source: "/conferences-list",
        destination: "/fr/conferences",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/conferences-list",
        destination: "/:locale/conferences",
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
        // The MCP server AI agents call (#514). Its public URL is the resource
        // their tokens are bound to.
        source: "/api/mcp",
        destination: `${backendUrl}/api/mcp`,
      },
      {
        // OAuth discovery for the MCP connector (#514): clients look for these
        // documents at the origin root (RFC 8414, RFC 9728), the backend serves
        // them. The dot in ".well-known" already keeps proxy.ts (next-intl) out.
        source: "/.well-known/:doc(oauth-protected-resource|oauth-authorization-server|openid-configuration)/:path*",
        destination: `${backendUrl}/.well-known/:doc/:path*`,
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
        // A sponsor's own space and its invitations (#362). Separate entries
        // from /api/sponsors above: that one is the public company page.
        source: "/api/sponsor-space/:path*",
        destination: `${backendUrl}/api/sponsor-space/:path*`,
      },
      {
        source: "/api/sponsor-invitation/:path*",
        destination: `${backendUrl}/api/sponsor-invitation/:path*`,
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
      // The rest of the public API (docs/api-publique.md). The site's own pages
      // reach the backend through BACKEND_URL, so nothing on the site broke
      // without these: only external clients got Next's HTML 404 (#494).
      // frontend-api-rewrites.test.ts (backend) fails on a route left out here.
      {
        source: "/api/articles/:path*",
        destination: `${backendUrl}/api/articles/:path*`,
      },
      {
        source: "/api/tags",
        destination: `${backendUrl}/api/tags`,
      },
      {
        source: "/api/pages/:path*",
        destination: `${backendUrl}/api/pages/:path*`,
      },
      {
        source: "/api/categories",
        destination: `${backendUrl}/api/categories`,
      },
      {
        source: "/api/settings/:path*",
        destination: `${backendUrl}/api/settings/:path*`,
      },
      {
        source: "/api/job-offers",
        destination: `${backendUrl}/api/job-offers`,
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
      // The generated social cards are resources, not pages, and Search Console
      // was reporting them among the crawled-not-indexed URLs (#468). They have
      // to stay fetchable — a blocked OG image is a broken share preview — so
      // the answer is a header, not robots.txt.
      {
        source: "/:path*/opengraph-image",
        headers: [
          { key: "X-Robots-Tag", value: "noindex" },
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
    // Sponsor logos are asked at 190-360 CSS px. Between Next's default 384
    // and 640 widths there was nothing, so at DPR 1.75-2 every logo of the
    // wall was served at 640 (#480). 448 and 512 fill the gap; imageSizes
    // must stay under the smallest deviceSize (640).
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 448, 512],
    // Next 16 only serves the qualities listed here, snapping any other to
    // the closest one: 60 is the hero photo's (#480), 75 the default.
    qualities: [60, 75],
    localPatterns: [
      { pathname: "/images/**" },
      { pathname: "/uploads/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      // Video thumbnails, proxied through /_next/image so the browser never
      // contacts Google before the visitor clicks play (#474). YouTube serves
      // the same images from both hosts depending on the video.
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
