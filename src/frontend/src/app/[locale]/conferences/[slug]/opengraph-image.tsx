import { ImageResponse } from "next/og";

import { getTalkBySlug } from "@/lib/api";

export const alt = "DevFest Toulouse — Session";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic OG image for a session (RG-215): title + speakers + category + branding.
export default async function TalkOgImage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const talk = await getTalkBySlug(slug);

  // Not localized (#293): a talk's title is in the language it is given in.
  const title = talk?.title ?? "DevFest Toulouse";
  const speakers = talk?.speakers.map((s) => s.name).join(", ") ?? "";
  const category = talk?.category ? (locale === "en" ? talk.category.nameEn : talk.category.nameFr) : "";

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
          background: "linear-gradient(135deg, #0B7350 0%, #109E6E 60%, #41B38E 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {category ? (
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 24, textTransform: "uppercase", letterSpacing: 2 }}>
            {category}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 64, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.1, maxWidth: 1040 }}>
          {title}
        </div>
        {speakers ? (
          <div style={{ display: "flex", fontSize: 36, color: "rgba(255,255,255,0.92)", marginTop: 32 }}>
            {speakers}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.8)", marginTop: 48 }}>
          DevFest Toulouse · devfesttoulouse.fr
        </div>
      </div>
    ),
    { ...size },
  );
}
