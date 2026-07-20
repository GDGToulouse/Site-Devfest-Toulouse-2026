import { ImageResponse } from "next/og";

import { getSpeakerBySlug } from "@/lib/api";

export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };

// US-250 — Downloadable social-media visual for a speaker.
// Distinct from the SEO opengraph-image: includes the session title and a
// "speaker announcement" layout meant to be shared on socials. An optional
// `?talk=<slug>` query selects which talk title to feature when a speaker has
// several; otherwise the first talk (if any) is used.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const speaker = await getSpeakerBySlug(slug);

  if (!speaker) {
    return new Response("Speaker not found", { status: 404 });
  }

  const talkSlug = new URL(request.url).searchParams.get("talk");
  const talk =
    speaker.talks.find((t) => t.slug === talkSlug) ?? speaker.talks[0] ?? null;
  const talkTitle = talk?.title ?? "";

  const { name, company, photoUrl } = speaker;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0B7350 0%, #109E6E 55%, #41B38E 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.9)",
            textTransform: "uppercase",
          }}
        >
          DevFest Toulouse · Speaker
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "56px" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              width={300}
              height={300}
              style={{
                width: 300,
                height: 300,
                borderRadius: 300,
                objectFit: "cover",
                border: "8px solid rgba(255,255,255,0.85)",
              }}
            />
          ) : (
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: 300,
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 140,
                fontWeight: 900,
                color: "#FFFFFF",
              }}
            >
              {name.charAt(0)}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 640,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 64,
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1.05,
              }}
            >
              {name}
            </div>
            {company ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 32,
                  color: "rgba(255,255,255,0.9)",
                  marginTop: 12,
                }}
              >
                {company}
              </div>
            ) : null}
            {talkTitle ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#F8AB06",
                  marginTop: 32,
                  lineHeight: 1.15,
                }}
              >
                « {talkTitle} »
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          devfesttoulouse.fr
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
