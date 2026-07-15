import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { getCurrentEdition, getSeoSettings } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";

export const alt = "DevFest Toulouse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, edition, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: "site" }),
    getCurrentEdition(),
    getSeoSettings(),
  ]);

  // This file convention wins over `openGraph.images` from generateMetadata, so
  // an admin-set og:image was being overridden by the generated visual — while
  // twitter:image, set explicitly, kept the custom one. The two tags disagreed
  // (#183). Honour the override here: serve the custom image's bytes when one is
  // set, and only fall back to the generated card otherwise.
  //
  // The bytes are proxied rather than redirected to: the convention expects an
  // image response, and OG scrapers do not all follow redirects reliably.
  const customOgImage = seoSettings.seo_og_image;
  if (customOgImage) {
    try {
      const upstream = await fetch(absoluteUrl(customOgImage));
      if (upstream.ok) {
        return new Response(upstream.body, {
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch {
      // Unreachable custom image — fall through to the generated card rather
      // than serving nothing.
    }
  }

  const year = edition?.year ?? new Date().getFullYear();
  const title = `DevFest Toulouse ${year}`;
  const subtitle = t("description");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0B7350 0%, #109E6E 50%, #41B38E 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "rgba(255,255,255,0.92)",
            marginTop: 32,
            lineHeight: 1.3,
            maxWidth: 1000,
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.8)",
            marginTop: 40,
            display: "flex",
            gap: 32,
          }}
        >
          <span style={{ display: "flex" }}>by GDG Toulouse</span>
          <span style={{ display: "flex" }}>devfesttoulouse.fr</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
