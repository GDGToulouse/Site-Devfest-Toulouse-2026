"use client";

import { createPortal } from "react-dom";

import type { PrintedLabel } from "@/lib/arrivals-api";
import { QR_GAP_MM, labelLayout, type LabelFormat } from "@/lib/badge-label";
import { formatFirstName, formatLastName } from "@/lib/person-name";

// The label as the Zebra prints it (RG-ARR-51, #713), at its real size in mm.
// The same drawing serves the on-screen preview and the print: what the
// volunteer checks is what comes out. Centred like the badges, with their QR
// code when there is a ticket (#801): under the text, or beside it on a short label.

/** The text alone (a QR code only comes back with the print), or the printed label. */
export type LabelContent = Omit<PrintedLabel, "qrSvg"> & { qrSvg?: string | null };

const qrSource = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

function Label({ text, format, year }: { text: LabelContent; format: LabelFormat; year: number }) {
  const layout = labelLayout(text, format);
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
        overflowWrap: "anywhere",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: beside ? "1.5mm" : "2mm",
          // Beside a QR code, the text takes the rest of the width.
          ...(beside ? { flex: 1, minWidth: 0 } : {}),
        }}
      >
        <span style={{ fontSize: beside ? "3mm" : "3.5mm", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          DevFest Toulouse {year}
        </span>
        {/* Same rule as the badge (#843): capital initials, last name in capitals. */}
        <span style={{ fontSize: `${layout.firstNameMm}mm` }}>{formatFirstName(text.firstName)}</span>
        <span style={{ fontSize: `${layout.lastNameMm}mm`, fontWeight: 500 }}>{formatLastName(text.lastName)}</span>
        {layout.companyMm && text.company && (
          <span style={{ fontSize: `${layout.companyMm}mm`, fontWeight: 500 }}>{text.company}</span>
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
