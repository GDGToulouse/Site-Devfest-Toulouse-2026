import { formatFirstName, formatLastName } from "./person-name";

// The help desk's label (RG-ARR-51, #713): first name, last name and company,
// printed black on white on the Zebra ZD421d through its driver, then stuck
// on a blank badge. The device picks the roll it prints on, and the text is
// sized to fit the label's width.
//
// Adding a roll is one entry in LABEL_FORMATS: its size, margin, QR code and
// text sizes. A label shorter than 10 cm has no room for the QR code under the
// text, so it goes beside it.

export type LabelFormatId = "100x150" | "100x100" | "80x50";

/** Largest and smallest size of a line, in mm of text height. */
interface LineSize {
  max: number;
  min: number;
}

export interface LabelFormat {
  id: LabelFormatId;
  name: string;
  widthMm: number;
  heightMm: number;
  /** Margin on each side, in mm: printers do not reach the edge of the label. */
  marginMm: number;
  /** The QR code's side, readable at arm's length by a phone (#801). */
  qrMm: number;
  /** Under the text on a tall label, beside it on a short one. */
  qrPlacement: "below" | "beside";
  sizes: { firstName: LineSize; lastName: LineSize; company: LineSize };
}

// Below the smallest size, a line wraps rather than becoming unreadable.
const LARGE_SIZES = {
  firstName: { max: 20, min: 9 },
  lastName: { max: 11, min: 6 },
  company: { max: 6, min: 4 },
} as const;

export const LABEL_FORMATS: Record<LabelFormatId, LabelFormat> = {
  "100x150": {
    id: "100x150",
    name: "10 × 15 cm",
    widthMm: 100,
    heightMm: 150,
    marginMm: 6,
    qrMm: 40,
    qrPlacement: "below",
    sizes: LARGE_SIZES,
  },
  "100x100": {
    id: "100x100",
    name: "10 × 10 cm",
    widthMm: 100,
    heightMm: 100,
    marginMm: 6,
    // Leaves the text its full size on the short roll.
    qrMm: 26,
    qrPlacement: "below",
    sizes: LARGE_SIZES,
  },
  // Landscape: 8 cm wide, 5 cm high. Four lines and a QR code in 42 mm of
  // height take smaller text and a thinner margin.
  "80x50": {
    id: "80x50",
    name: "8 × 5 cm",
    widthMm: 80,
    heightMm: 50,
    marginMm: 4,
    qrMm: 22,
    qrPlacement: "beside",
    sizes: {
      firstName: { max: 11, min: 6 },
      lastName: { max: 7, min: 4.5 },
      company: { max: 4.5, min: 3.5 },
    },
  },
};

/** Space between the text and a QR code beside it, in mm. */
export const QR_GAP_MM = 3;

const DEFAULT_FORMAT: LabelFormatId = "100x150";
const STORAGE_KEY = "devfest-arrivals-label-format";

const isFormatId = (value: string): value is LabelFormatId =>
  Object.prototype.hasOwnProperty.call(LABEL_FORMATS, value);

/** The roll this device prints on: set once at the help desk, kept on the device. */
export function readLabelFormat(): LabelFormat {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isFormatId(stored)) return LABEL_FORMATS[stored];
  } catch {
    // Storage blocked: the default roll.
  }
  return LABEL_FORMATS[DEFAULT_FORMAT];
}

export function saveLabelFormat(id: LabelFormatId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // The choice holds until the page closes.
  }
}

// Average glyph width of a bold sans-serif, as a share of its size: a rough
// figure, generous enough that a name sized by it stays on one line.
const GLYPH_WIDTH = 0.6;

const length = (text: string) => [...text.normalize("NFC")].length;

function fit(text: string, usableMm: number, { max, min }: LineSize): number {
  const fitting = usableMm / (Math.max(length(text), 1) * GLYPH_WIDTH);
  return Math.round(Math.min(max, Math.max(min, fitting)) * 10) / 10;
}

export interface LabelLayout {
  firstNameMm: number;
  lastNameMm: number;
  companyMm: number | null;
  /** The QR code's side; null without a ticket (#801). */
  qrMm: number | null;
}

/** Sizes for one person on one roll: each line as large as fits its width, the QR code under or beside it. */
export function labelLayout(
  text: { firstName: string; lastName: string; company: string | null; qrSvg?: string | null },
  format: LabelFormat,
): LabelLayout {
  const qrMm = text.qrSvg ? format.qrMm : null;
  const besideQr = qrMm !== null && format.qrPlacement === "beside" ? qrMm + QR_GAP_MM : 0;
  const usable = format.widthMm - 2 * format.marginMm - besideQr;
  return {
    firstNameMm: fit(formatFirstName(text.firstName), usable, format.sizes.firstName),
    // Printed in capitals (#843), which run wider.
    lastNameMm: fit(formatLastName(text.lastName), usable / 1.15, format.sizes.lastName),
    companyMm: text.company ? fit(text.company, usable, format.sizes.company) : null,
    qrMm,
  };
}
