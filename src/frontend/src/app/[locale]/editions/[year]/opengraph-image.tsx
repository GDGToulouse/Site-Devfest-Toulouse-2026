import { ImageResponse } from "next/og";

import { getEditionByYear } from "@/lib/api";

export const alt = "DevFest Toulouse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string; year: string }>;
}) {
  const { locale, year: yearStr } = await params;
  const year = Number(yearStr);
  const edition = await getEditionByYear(year);

  const figures = edition?.keyFigures?.slice(0, 3) ?? [];
  const subtitle =
    locale === "en"
      ? `Recap of the ${year} edition`
      : `Bilan de l'édition ${year}`;

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
            fontSize: 140,
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
          }}
        >
          DevFest Toulouse {year}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "rgba(255,255,255,0.92)",
            marginTop: 24,
          }}
        >
          {subtitle}
        </div>
        {figures.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 56,
              marginTop: 56,
            }}
          >
            {figures.map((f) => (
              <div
                key={f.icon + f.value}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <span
                  style={{
                    display: "flex",
                    fontSize: 72,
                    fontWeight: 900,
                    color: "#FFFFFF",
                  }}
                >
                  {f.value}
                </span>
                <span
                  style={{
                    display: "flex",
                    fontSize: 24,
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {locale === "en" ? f.labelEn : f.labelFr}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
