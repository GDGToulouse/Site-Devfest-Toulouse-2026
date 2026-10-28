import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BADGES_PER_BIN, slotOfNumber } from "./badge-numbering.js";

// Placeholder render (#639): the team's badge design is not ready, so each
// badge is an A6 page with what the counters need to file it and hand it over.
// The order and the separator pages are the real contract (RG-ARR-19).
const PAGE: [number, number] = [297.64, 419.53];
const MARGIN = 24;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);

export interface PrintedBadge {
  badgeNumber: number;
  firstName: string;
  lastName: string;
  company: string | null;
  tierName: string | null;
}

// The standard fonts only know WinAnsi: accents survive, other scripts fall
// back to their base letter, then to "?", rather than failing the whole file.
function printable(font: PDFFont, text: string): string {
  const known = new Set(font.getCharacterSet());
  return [...text]
    .map((ch) => {
      if (known.has(ch.codePointAt(0) as number)) return ch;
      const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
      return [...base].every((c) => known.has(c.codePointAt(0) as number)) && base ? base : "?";
    })
    .join("");
}

// Shrinks a line until it fits the badge width, down to a floor.
function drawCentered(page: PDFPage, font: PDFFont, raw: string, y: number, size: number, color = INK) {
  const text = printable(font, raw);
  const maxWidth = PAGE[0] - 2 * MARGIN;
  let fitted = size;
  while (fitted > 8 && font.widthOfTextAtSize(text, fitted) > maxWidth) fitted -= 1;
  const width = font.widthOfTextAtSize(text, fitted);
  page.drawText(text, { x: (PAGE[0] - width) / 2, y, size: fitted, font, color });
}

/** Badges sorted by number, with a separator page before each bin. */
export async function renderBadgePdf(editionYear: number, badges: PrintedBadge[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Badges DevFest Toulouse ${editionYear}`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const sorted = [...badges].sort((a, b) => a.badgeNumber - b.badgeNumber);
  const binOf = (n: number) => Math.floor(n / BADGES_PER_BIN);
  const countByBin = new Map<number, number>();
  for (const b of sorted) countByBin.set(binOf(b.badgeNumber), (countByBin.get(binOf(b.badgeNumber)) ?? 0) + 1);

  let currentBin: number | null = null;
  for (const badge of sorted) {
    const { counter, bin } = slotOfNumber(badge.badgeNumber);
    if (binOf(badge.badgeNumber) !== currentBin) {
      currentBin = binOf(badge.badgeNumber);
      const separator = doc.addPage(PAGE);
      const first = counter * 1000 + bin * 100;
      drawCentered(separator, bold, `Guichet ${counter}`, 300, 36);
      drawCentered(separator, bold, `Bac ${bin}`, 250, 36);
      drawCentered(separator, regular, `Badges ${first} à ${first + 99}`, 200, 16);
      drawCentered(separator, regular, `${countByBin.get(currentBin)} badges`, 175, 14, MUTED);
    }

    const page = doc.addPage(PAGE);
    drawCentered(page, regular, `DevFest Toulouse ${editionYear}`, PAGE[1] - 50, 12, MUTED);
    drawCentered(page, bold, badge.firstName, 250, 30);
    drawCentered(page, bold, badge.lastName.toUpperCase(), 215, 22);
    if (badge.company) drawCentered(page, regular, badge.company, 180, 16);
    if (badge.tierName) drawCentered(page, regular, badge.tierName, 100, 11, MUTED);
    drawCentered(page, bold, `${badge.badgeNumber}`, 40, 18);
    drawCentered(page, regular, `Guichet ${counter} · Bac ${bin}`, 24, 9, MUTED);
  }
  return doc.save();
}
