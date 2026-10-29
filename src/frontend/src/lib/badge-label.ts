// The help desk's label (RG-ARR-51, #713): first name, last name and company,
// printed black on white on the Zebra ZD421d through its driver, then stuck
// on a blank badge. The roll is 10 × 10 or 10 × 15 cm, not yet measured: the
// device picks its format, and the text is sized to fit its width.

export type LabelFormatId = "100x150" | "100x100";

export interface LabelFormat {
  id: LabelFormatId;
  name: string;
  widthMm: number;
  heightMm: number;
}

export const LABEL_FORMATS: Record<LabelFormatId, LabelFormat> = {
  "100x150": { id: "100x150", name: "10 × 15 cm", widthMm: 100, heightMm: 150 },
  "100x100": { id: "100x100", name: "10 × 10 cm", widthMm: 100, heightMm: 100 },
};

const DEFAULT_FORMAT: LabelFormatId = "100x150";
const STORAGE_KEY = "devfest-arrivals-label-format";

/** The roll this device prints on: set once at the help desk, kept on the device. */
export function readLabelFormat(): LabelFormat {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "100x150" || stored === "100x100") return LABEL_FORMATS[stored];
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

/** Margin on each side, in mm: printers do not reach the edge of the label. */
export const LABEL_MARGIN_MM = 6;

// Average glyph width of a bold sans-serif, as a share of its size: a rough
// figure, generous enough that a name sized by it stays on one line.
const GLYPH_WIDTH = 0.6;

// Largest and smallest size of each line, in mm of text height. Below the
// smallest, the line wraps rather than becoming unreadable at arm's length.
const SIZES = {
  firstName: { max: 20, min: 9 },
  lastName: { max: 11, min: 6 },
  company: { max: 6, min: 4 },
} as const;

const length = (text: string) => [...text.normalize("NFC")].length;

function fit(text: string, usableMm: number, { max, min }: { max: number; min: number }): number {
  const fitting = usableMm / (Math.max(length(text), 1) * GLYPH_WIDTH);
  return Math.round(Math.min(max, Math.max(min, fitting)) * 10) / 10;
}

export interface LabelLayout {
  firstNameMm: number;
  lastNameMm: number;
  companyMm: number | null;
}

/** Text sizes for one person on one roll: each line as large as fits its width. */
export function labelLayout(
  text: { firstName: string; lastName: string; company: string | null },
  format: LabelFormat,
): LabelLayout {
  const usable = format.widthMm - 2 * LABEL_MARGIN_MM;
  return {
    firstNameMm: fit(text.firstName, usable, SIZES.firstName),
    // Printed in capitals, which run wider.
    lastNameMm: fit(text.lastName.toUpperCase(), usable / 1.15, SIZES.lastName),
    companyMm: text.company ? fit(text.company, usable, SIZES.company) : null,
  };
}
