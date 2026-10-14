import { ImageResponse } from "next/og";

import { getEditionTalkBySlug, getTalkBySlug } from "@/lib/api";
import { formatEventDate, formatEventTime } from "@/lib/datetime";
import { imageDataUri } from "@/lib/og-image";

export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };
// The card has room for three faces; the names line lists everyone.
const MAX_PHOTOS = 3;

// #116 — downloadable social-media visual announcing a talk, on the model of
// the speakers' card (US-250, #80). A talk slug is unique per edition only,
// so `?year=` picks the edition; without it, the featured one.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const year = Number(new URL(request.url).searchParams.get("year"));
  const talk = Number.isInteger(year) && year > 0 ? await getEditionTalkBySlug(year, slug) : await getTalkBySlug(slug);

  if (!talk) {
    return new Response("Talk not found", { status: 404 });
  }

  const speakers = talk.speakers;
  // Satori only takes an absolute or inline source (#600).
  const photos = await Promise.all(
    speakers.slice(0, MAX_PHOTOS).map(async (s) => ({ name: s.name, src: s.photoUrl ? await imageDataUri(s.photoUrl) : null })),
  );
  // Paris time: the container runs in UTC.
  const slot = talk.startsAt
    ? `${formatEventDate(talk.startsAt, "fr")} · ${formatEventTime(talk.startsAt)}${talk.room ? ` · ${talk.room}` : ""}`
    : null;

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
          background: "linear-gradient(135deg, #0B7350 0%, #109E6E 55%, #41B38E 100%)",
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
          {`DevFest Toulouse ${talk.year}${talk.category ? ` · ${talk.category.nameFr}` : ""}`}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.1, maxWidth: 1056 }}>
            {talk.title}
          </div>

          {speakers.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "24px", marginTop: 40 }}>
              <div style={{ display: "flex" }}>
                {photos.map((p, i) =>
                  p.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.name}
                      src={p.src}
                      alt=""
                      width={110}
                      height={110}
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius: 110,
                        objectFit: "cover",
                        border: "5px solid rgba(255,255,255,0.85)",
                        marginLeft: i === 0 ? 0 : -24,
                      }}
                    />
                  ) : (
                    <div
                      key={p.name}
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius: 110,
                        background: "#41B38E",
                        border: "5px solid rgba(255,255,255,0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 48,
                        fontWeight: 900,
                        color: "#FFFFFF",
                        marginLeft: i === 0 ? 0 : -24,
                      }}
                    >
                      {p.name.charAt(0)}
                    </div>
                  ),
                )}
              </div>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#FFFFFF", maxWidth: 760 }}>
                {speakers.map((s) => s.name).join(", ")}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "rgba(255,255,255,0.85)" }}>
          <div style={{ display: "flex" }}>{slot ?? ""}</div>
          <div style={{ display: "flex" }}>devfesttoulouse.fr</div>
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
