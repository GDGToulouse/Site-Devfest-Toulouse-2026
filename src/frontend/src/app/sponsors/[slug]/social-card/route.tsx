import { ImageResponse } from "next/og";

import { getSponsorBySlug } from "@/lib/api";
import { imageDataUri } from "@/lib/og-image";

export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };

// #116 — downloadable social-media visual announcing a sponsor, on the model of
// the speakers' card (US-250, #80). The logo sits on a white panel: partners'
// logos are drawn for a light background, and many are dark on transparent.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sponsor = await getSponsorBySlug(slug);

  if (!sponsor) {
    return new Response("Sponsor not found", { status: 404 });
  }

  // The tier is the featured edition's (#375); the most recent year it took
  // part in names the edition on the card.
  const year = sponsor.editions.length > 0 ? Math.max(...sponsor.editions) : null;
  const tier = sponsor.tier;
  // Satori only takes an absolute or inline source (#600).
  const logoUrl = sponsor.logoUrl ? await imageDataUri(sponsor.logoUrl) : null;

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
          {year ? `DevFest Toulouse ${year} · Partenaire` : "DevFest Toulouse · Partenaire"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "56px" }}>
          <div
            style={{
              width: 420,
              height: 260,
              borderRadius: 24,
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" style={{ maxWidth: 356, maxHeight: 196, objectFit: "contain" }} />
            ) : (
              <div style={{ display: "flex", fontSize: 56, fontWeight: 900, color: "#0B7350", textAlign: "center" }}>
                {sponsor.name}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
            <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.9)" }}>Merci à</div>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.05, marginTop: 8 }}>
              {sponsor.name}
            </div>
            {tier ? (
              // The tier's colour as a dot, not as the text: a Gold drawn in
              // yellow on white could not be read.
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  gap: 14,
                  marginTop: 28,
                  padding: "10px 24px",
                  borderRadius: 999,
                  background: "#FFFFFF",
                  color: "#1D1D1B",
                  fontSize: 30,
                  fontWeight: 800,
                }}
              >
                <div style={{ display: "flex", width: 22, height: 22, borderRadius: 22, background: tier.color || "#0B7350" }} />
                Sponsor {tier.nameFr}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.85)" }}>devfesttoulouse.fr</div>
      </div>
    ),
    { ...SIZE },
  );
}
