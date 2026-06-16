import { ImageResponse } from "next/og";

import { getSpeakerBySlug } from "@/lib/api";

export const alt = "DevFest Toulouse — Speaker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic OG image for a speaker (RG-208): photo + name + branding.
export default async function SpeakerOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const speaker = await getSpeakerBySlug(slug);
  const name = speaker?.name ?? "DevFest Toulouse";
  const company = speaker?.company ?? "";
  const photoUrl = speaker?.photoUrl ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: "64px",
          padding: "80px",
          background: "linear-gradient(135deg, #0B7350 0%, #109E6E 60%, #41B38E 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={360}
            height={360}
            style={{ width: 360, height: 360, borderRadius: 360, objectFit: "cover", border: "8px solid rgba(255,255,255,0.85)" }}
          />
        ) : (
          <div
            style={{
              width: 360,
              height: 360,
              borderRadius: 360,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 160,
              fontWeight: 900,
              color: "#FFFFFF",
            }}
          >
            {name.charAt(0)}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.05 }}>
            {name}
          </div>
          {company ? (
            <div style={{ display: "flex", fontSize: 36, color: "rgba(255,255,255,0.9)", marginTop: 16 }}>
              {company}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.8)", marginTop: 48 }}>
            DevFest Toulouse · devfesttoulouse.fr
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
