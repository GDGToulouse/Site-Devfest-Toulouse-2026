import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { getCurrentEdition, getSeoSettings } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";

export const alt = "DevFest Toulouse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_GRADIENT = "linear-gradient(135deg, #0B7350 0%, #109E6E 50%, #41B38E 100%)";

// Satori has no network of its own inside the container, so the uploaded image
// travels as a data URI. Ceiling well above any legitimate OG image (the admin
// upload limit is 5 MB) — an oversized or unreachable file falls back to the
// generated card rather than to no image at all.
const MAX_CUSTOM_IMAGE_BYTES = 8 * 1024 * 1024;

async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return null;

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_CUSTOM_IMAGE_BYTES) return null;

    const type = upstream.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

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
  // (#183). Honour the override here: it is the only place the setting is read,
  // which is what keeps og:image and twitter:image on the same URL (#384).
  //
  // The image is *redrawn* onto a 1200×630 canvas rather than served as-is.
  // `size` below is what feeds og:image:width/height, so proxying the raw bytes
  // announced 1200×630 for whatever the organizer had uploaded — in production,
  // a 600×271 file. LinkedIn read the real pixels, found them under its 1200×627
  // minimum, and fell back to a small preview (#235). Redrawing makes the
  // declared size true whatever is uploaded.
  //
  // `contain` on the brand gradient, not `cover`: a logo cropped to fill is
  // worse than one with green bands around it.
  const customOgImage = seoSettings.seo_og_image;
  const customOgDataUri = customOgImage ? await fetchAsDataUri(absoluteUrl(customOgImage)) : null;
  if (customOgDataUri) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: BRAND_GRADIENT,
          }}
        >
          <img src={customOgDataUri} alt="" width={size.width} height={size.height} style={{ objectFit: "contain" }} />
        </div>
      ),
      { ...size },
    );
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
          background: BRAND_GRADIENT,
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
