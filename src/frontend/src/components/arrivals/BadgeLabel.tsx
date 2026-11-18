"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { PrintedLabel } from "@/lib/arrivals-api";
import { QR_GAP_MM, estimateTextWidth, labelLayout, type LabelFormat, type MeasureText } from "@/lib/badge-label";
import { formatFirstName, formatLastName } from "@/lib/person-name";

// The label as the Zebra prints it (RG-ARR-51, #713), at its real size in mm.
// The same drawing serves the on-screen preview and the print: what the
// volunteer checks is what comes out. Centred like the badges, with their QR
// code when there is a ticket (#801): under the text, or beside it on a short label.

/** The text alone (a QR code only comes back with the print), or the printed label. */
export type LabelContent = Omit<PrintedLabel, "qrSvg"> & { qrSvg?: string | null };

const qrSource = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/**
 * Text widths measured in the page's own font, once it has loaded (#713). The
 * printed label is hidden until it prints, so it cannot be measured in place:
 * a canvas measures the same font off screen. Until then, and where there is
 * no canvas, the letter-count estimate stands in.
 */
function useLabelMeasure(): MeasureText {
  const [measure, setMeasure] = useState<MeasureText>(() => estimateTextWidth);
  useEffect(() => {
    let isActive = true;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    const family = getComputedStyle(document.body).fontFamily;
    const real: MeasureText = (value, weight) => {
      context.font = `${weight} 100px ${family}`;
      return context.measureText(value).width / 100;
    };
    // `document.fonts` is missing in some engines: measure with what is there.
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (isActive) setMeasure(() => real);
    });
    return () => {
      isActive = false;
    };
  }, []);
  return measure;
}

// One line each, whatever the name's length: the size shrinks instead (#713).
const LINE = { whiteSpace: "nowrap" } as const;

function Label({ text, format, year }: { text: LabelContent; format: LabelFormat; year: number }) {
  const measure = useLabelMeasure();
  const layout = labelLayout(text, format, measure);
  const beside = format.qrPlacement === "beside";
  const qr = layout.qrMm && text.qrSvg && (
    // eslint-disable-next-line @next/next/no-img-element -- an inline SVG from the backend, at a size in mm
    <img
      src={qrSource(text.qrSvg)}
      alt="QR code du billet"
      style={{
        width: `${layout.qrMm}mm`,
        height: `${layout.qrMm}mm`,
        flexShrink: 0,
        ...(beside ? {} : { marginTop: "3mm" }),
      }}
    />
  );
  return (
    <div
      style={{
        width: `${format.widthMm}mm`,
        height: `${format.heightMm}mm`,
        padding: `${format.marginMm}mm`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: beside ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: beside ? `${QR_GAP_MM}mm` : "2mm",
        textAlign: "center",
        background: "#fff",
        color: "#000",
        fontWeight: 700,
        lineHeight: 1.05,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: beside ? "1.5mm" : "2mm",
          // Beside a QR code, the text takes the rest of the width; under it, the whole width.
          ...(beside ? { flex: 1, minWidth: 0 } : { width: "100%" }),
        }}
      >
        <span style={{ ...LINE, fontSize: beside ? "3mm" : "3.5mm", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          DevFest Toulouse {year}
        </span>
        {/* Same rule as the badge (#843): capital initials, last name in capitals. */}
        <span style={{ ...LINE, fontSize: `${layout.firstNameMm}mm` }}>{formatFirstName(text.firstName)}</span>
        <span style={{ ...LINE, fontSize: `${layout.lastNameMm}mm`, fontWeight: 500 }}>{formatLastName(text.lastName)}</span>
        {layout.companyMm && text.company && (
          <span style={{ ...LINE, fontSize: `${layout.companyMm}mm`, fontWeight: 500 }}>{text.company}</span>
        )}
      </div>
      {qr}
    </div>
  );
}

/** On screen, shrunk to fit: the volunteer checks spelling before printing. */
export function LabelPreview({ text, format, year }: { text: LabelContent; format: LabelFormat; year: number }) {
  // 1 mm is about 3.78 CSS px; the preview takes 60 % of that.
  const scale = 0.6;
  return (
    <div
      aria-label={`Aperçu de l'étiquette ${format.name}`}
      className="overflow-hidden rounded border border-gris/30"
      style={{ width: `${format.widthMm * scale}mm`, height: `${format.heightMm * scale}mm`, maxWidth: "100%" }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <Label text={text} format={format} year={year} />
      </div>
    </div>
  );
}

/**
 * The printed sheet: off screen, alone on paper. Outside the app's tree so
 * nothing of the screen prints with it, and the page takes the roll's size.
 */
export function LabelSheet({ text, format, year }: { text: LabelContent; format: LabelFormat; year: number }) {
  return createPortal(
    <div className="print-only">
      <style>{`@media print { @page { size: ${format.widthMm}mm ${format.heightMm}mm; margin: 0; } }`}</style>
      <Label text={text} format={format} year={year} />
    </div>,
    document.body,
  );
}
