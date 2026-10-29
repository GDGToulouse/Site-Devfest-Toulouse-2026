"use client";

import { createPortal } from "react-dom";

import type { LabelText } from "@/lib/arrivals-api";
import { LABEL_MARGIN_MM, labelLayout, type LabelFormat } from "@/lib/badge-label";

// The label as the Zebra prints it (RG-ARR-51, #713), at its real size in mm.
// The same drawing serves the on-screen preview and the print: what the
// volunteer checks is what comes out.

function Label({ text, format, year }: { text: LabelText; format: LabelFormat; year: number }) {
  const layout = labelLayout(text, format);
  return (
    <div
      style={{
        width: `${format.widthMm}mm`,
        height: `${format.heightMm}mm`,
        padding: `${LABEL_MARGIN_MM}mm`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "2mm",
        background: "#fff",
        color: "#000",
        fontWeight: 700,
        lineHeight: 1.05,
        overflowWrap: "anywhere",
      }}
    >
      <span style={{ fontSize: "3.5mm", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        DevFest Toulouse {year}
      </span>
      <span style={{ fontSize: `${layout.firstNameMm}mm` }}>{text.firstName}</span>
      <span style={{ fontSize: `${layout.lastNameMm}mm`, fontWeight: 500, textTransform: "uppercase" }}>
        {text.lastName}
      </span>
      {layout.companyMm && text.company && (
        <span style={{ fontSize: `${layout.companyMm}mm`, fontWeight: 500 }}>{text.company}</span>
      )}
    </div>
  );
}

/** On screen, shrunk to fit: the volunteer checks spelling before printing. */
export function LabelPreview({ text, format, year }: { text: LabelText; format: LabelFormat; year: number }) {
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
export function LabelSheet({ text, format, year }: { text: LabelText; format: LabelFormat; year: number }) {
  return createPortal(
    <div className="print-only">
      <style>{`@media print { @page { size: ${format.widthMm}mm ${format.heightMm}mm; margin: 0; } }`}</style>
      <Label text={text} format={format} year={year} />
    </div>,
    document.body,
  );
}
