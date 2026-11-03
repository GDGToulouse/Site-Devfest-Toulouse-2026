import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";

import type { BadgeType } from "../generated/prisma/client.js";
import { NUMBERS_PER_BIN, formatBadgeNumber, slotOfNumber } from "./badge-numbering.js";
import { BADGE_TYPE_NAMES, DEFAULT_QR_COLOR, builtInBackground, type BadgeDesign } from "./badge-design.js";
import { UPLOADS_DIR } from "./image-store.js";

// The print file (RG-ARR-19, #639, #774): recto-verso, pages alternating. Each
// badge's front on its type's background is followed by that type's back; each
// separator by a blank back, so fronts and backs never shift. The numbered
// badges (participants and sponsors) come first, in number order with a
// separator before each bin; then the others, by type and name. Positions are
// points on the designer's V3 file.

const PAGE: [number, number] = [297.638, 419.528];
const [W, H] = PAGE;
// Measured on the designer's V3 file (#774), PDF origin bottom-left. The light
// square holding the QR code belongs to the backgrounds; the QR code is
// centred in it, on the 29 modules' footprint of the design.
const QR = { left: 114.31, bottom: 140.46, side: 65.9 };
const QR_SQUARE_TOP = 131.386 + 84.047;
// The type ribbon's lower edge: the name, company and QR square sit between.
const RIBBON_BOTTOM = 345;
const TEXT_MARGIN = 20;
// Clearance kept to the ribbon and to the QR square, accents included.
const CLEARANCE = 4;
const TEXT_TOP = RIBBON_BOTTOM - CLEARANCE;
const TEXT_BOTTOM = QR_SQUARE_TOP + CLEARANCE;
const FIRST_NAME = { size: 28, min: 16, maxLines: 2, baseline: 305.77 };
const LAST_NAME = { size: 24, min: 12, maxLines: 2, baseline: 275.76 };
const COMPANY = { size: 16, min: 9, maxLines: 3, baseline: 245.4, tracking: 0.05 };
// Baseline to baseline of two lines of the same text, and the glyphs' reach
// above and below their baseline (accented capitals, descenders).
const LINE_PITCH = 1.12;
const ASCENT = 0.95;
const DESCENT = 0.25;
// The number, top right, on numbered badges: right-aligned.
const NUMBER = { size: 14, baseline: 397.58, right: W - 13.5 };
// The separators sit on a white page: the design's violet, whatever the text colour.
const SEPARATOR_COLOR = DEFAULT_QR_COLOR;
// A6 at 300 dpi, for a vector background turned into an image.
const BACKGROUND_PIXELS = { width: 1240, height: 1748 };

const ASSETS = new URL("../../assets/", import.meta.url);
export const OTHER_TYPES_ORDER: BadgeType[] = ["STAFF", "SPEAKER", "VOLUNTEER", "CONTRACTOR"];
// The company's font: CC Sign Language in the design (licence pending), Google
// Sans Bold meanwhile. Swap this one file to change it.
const BOLD_FONT_FILE = "fonts/GoogleSans-Bold.ttf";
const COMPANY_FONT_FILE = BOLD_FONT_FILE;

export interface PrintedBadge {
  type: BadgeType;
  /** Badges through the counters (participant, sponsor) only. */
  badgeNumber: number | null;
  firstName: string;
  lastName: string;
  company: string | null;
  /** The ticket's code: what Billetweb's badge app reads in the QR code. */
  barcode: string;
}

function hexToRgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// A glyph the font lacks falls back to its base letter, then "?", rather
// than an empty box on a printed badge.
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

/**
 * The largest size from `max` down to `min` at which the text holds in
 * `maxLines` lines of `width`, broken between words. Below `min`, a word
 * that cannot fit shrinks further rather than overflow the zone.
 */
export function fitLines(
  font: PDFFont,
  raw: string,
  width: number,
  { max, min, maxLines, tracking = 0 }: { max: number; min: number; maxLines: number; tracking?: number },
): { lines: string[]; size: number } {
  // Letter spacing (in em) is part of a line's width.
  const measure = (t: string, size: number) => font.widthOfTextAtSize(t, size) + tracking * size * Math.max(0, [...t].length - 1);
  const text = printable(font, raw.trim());
  // Break after a space or a hyphen, keeping the hyphen on its line.
  const words = text.split(/(?<=[\s-])/).filter((w) => w.trim().length > 0);
  const wrap = (size: number) => {
    const lines: string[] = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last !== undefined && measure(last + word, size) <= width) lines[lines.length - 1] = last + word;
      else lines.push(word);
    }
    return lines.map((l) => l.trimEnd());
  };
  const fits = (lines: string[], size: number, count: number) =>
    lines.length <= count && lines.every((l) => measure(l, size) <= width);
  // Fewer lines first, as long as the text stays near its full size: a name
  // reads better on one line a little smaller than broken in two.
  const preferredMin = Math.max(min, Math.round(max * 0.7));
  for (let count = 1; count <= maxLines; count++) {
    for (let size = max; size >= preferredMin; size -= 1) {
      const lines = wrap(size);
      if (fits(lines, size, count)) return { lines, size };
    }
  }
  for (let size = preferredMin - 1; size >= min; size -= 1) {
    const lines = wrap(size);
    if (fits(lines, size, maxLines)) return { lines, size };
  }
  // Too long even at the floor: the floor's lines, the overflow folded into
  // the last one, all of it shrunk to fit.
  const lines = wrap(min);
  const kept = [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(" ")];
  const widest = Math.max(...kept.map((l) => measure(l, min)));
  return { lines: kept, size: Math.min(min, (min * width) / widest) };
}

function drawCentered(page: PDFPage, font: PDFFont, text: string, y: number, size: number, color: RGB) {
  page.drawText(text, { x: (W - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
}

// Letter-spaced text, one glyph at a time, centred on the page.
function drawTracked(page: PDFPage, font: PDFFont, text: string, y: number, size: number, tracking: number, color: RGB) {
  const glyphs = [...text];
  const width = glyphs.reduce((sum, g) => sum + font.widthOfTextAtSize(g, size), 0) + tracking * size * (glyphs.length - 1);
  let x = (W - width) / 2;
  for (const glyph of glyphs) {
    page.drawText(glyph, { x, y, size, font, color });
    x += font.widthOfTextAtSize(glyph, size) + tracking * size;
  }
}

export interface TextLine {
  text: string;
  size: number;
  y: number;
  /** Letter spacing, in em. */
  tracking: number;
  role: "first" | "last" | "company";
}

/**
 * Where the person's lines go: first name, last name, company, centred, between
 * the type ribbon and the QR square (#774). A short name sits on the designer's
 * baselines; long ones shrink, wrap, and push the block down, then the whole
 * block shrinks until it fits between the two, never touching either.
 */
export function layoutBadgeText(
  fonts: Pick<Fonts, "bold" | "company">,
  badge: Pick<PrintedBadge, "firstName" | "lastName" | "company">,
): { lines: TextLine[]; top: number; bottom: number } {
  const width = W - 2 * TEXT_MARGIN;
  const groups = [
    { role: "first" as const, font: fonts.bold, text: badge.firstName, spec: FIRST_NAME, tracking: 0 },
    { role: "last" as const, font: fonts.bold, text: badge.lastName, spec: LAST_NAME, tracking: 0 },
    ...(badge.company
      ? [{ role: "company" as const, font: fonts.company, text: badge.company, spec: COMPANY, tracking: COMPANY.tracking }]
      : []),
  ];
  let result: { lines: TextLine[]; top: number; bottom: number } | null = null;
  for (let scale = 1; scale >= 0.4; scale -= 0.05) {
    const lines: TextLine[] = [];
    let y = FIRST_NAME.baseline;
    groups.forEach((group, g) => {
      const fitted = fitLines(group.font, group.text, width, {
        max: group.spec.size * scale,
        min: Math.max(6, group.spec.min * scale),
        maxLines: group.spec.maxLines,
        tracking: group.tracking,
      });
      if (g > 0) {
        // The designer's distance from the group above, scaled with the text.
        const previous = groups[g - 1].spec;
        y -= (previous.baseline - group.spec.baseline) * scale;
      }
      fitted.lines.forEach((text, i) => {
        if (i > 0) y -= fitted.size * LINE_PITCH;
        lines.push({ text, size: fitted.size, y, tracking: group.tracking, role: group.role });
      });
    });
    const first = lines[0];
    const last = lines[lines.length - 1];
    let top = first.y + first.size * ASCENT;
    let bottom = last.y - last.size * DESCENT;
    // Overflowing the QR square: climb into the room left under the ribbon.
    if (bottom < TEXT_BOTTOM) {
      const shift = Math.min(TEXT_BOTTOM - bottom, Math.max(0, TEXT_TOP - top));
      for (const line of lines) line.y += shift;
      top += shift;
      bottom += shift;
    }
    result = { lines, top, bottom };
    if (top <= TEXT_TOP + 0.001 && bottom >= TEXT_BOTTOM - 0.001) break;
  }
  return result as { lines: TextLine[]; top: number; bottom: number };
}

/** vCard 3.0 of the badge: name and company, never the email. */
export function badgeVCard(badge: Pick<PrintedBadge, "firstName" | "lastName" | "company">): string {
  const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, " ");
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escape(badge.lastName)};${escape(badge.firstName)};;;`,
    `FN:${escape(`${badge.firstName} ${badge.lastName}`)}`,
    ...(badge.company ? [`ORG:${escape(badge.company)}`] : []),
    "END:VCARD",
  ].join("\r\n");
}

// The QR code as squares in the design's colour: vector, sharp at any size.
function drawQr(page: PDFPage, content: string, color: RGB) {
  const { modules } = QRCode.create(content, { errorCorrectionLevel: "M" });
  const cell = QR.side / modules.size;
  for (let row = 0; row < modules.size; row++) {
    let start = -1;
    for (let col = 0; col <= modules.size; col++) {
      const isDark = col < modules.size && modules.data[row * modules.size + col] === 1;
      if (isDark && start < 0) start = col;
      if (!isDark && start >= 0) {
        page.drawRectangle({
          x: QR.left + start * cell,
          y: QR.bottom + (modules.size - row - 1) * cell,
          width: (col - start) * cell,
          height: cell,
          color,
        });
        start = -1;
      }
    }
  }
}

type Background = (page: PDFPage) => void;

/** A background from the media library or the built-in one, drawn full page. */
async function loadBackground(doc: PDFDocument, uploadPath: string | null, builtIn: string): Promise<Background> {
  const file = uploadPath ? path.join(UPLOADS_DIR, path.basename(uploadPath)) : new URL(builtIn, ASSETS);
  const bytes = await readFile(file);
  const extension = uploadPath ? path.extname(uploadPath).toLowerCase() : path.extname(builtIn).toLowerCase();
  if (extension === ".pdf") {
    const [embedded] = await doc.embedPdf(bytes, [0]);
    return (page) => page.drawPage(embedded, { x: 0, y: 0, width: W, height: H });
  }
  const image =
    extension === ".jpg" || extension === ".jpeg"
      ? await doc.embedJpg(bytes)
      : await doc.embedPng(
          extension === ".svg"
            ? await sharp(bytes, { density: 300 }).resize(BACKGROUND_PIXELS.width, BACKGROUND_PIXELS.height, { fit: "fill" }).png().toBuffer()
            : bytes,
        );
  return (page) => page.drawImage(image, { x: 0, y: 0, width: W, height: H });
}

interface Fonts {
  bold: PDFFont;
  company: PDFFont;
}

function drawBadge(page: PDFPage, badge: PrintedBadge, fonts: Fonts, color: RGB, qrColor: RGB, qrContent: BadgeDesign["qrContent"]) {
  for (const line of layoutBadgeText(fonts, badge).lines) {
    if (line.role === "company") drawTracked(page, fonts.company, line.text, line.y, line.size, line.tracking, color);
    else drawCentered(page, fonts.bold, line.text, line.y, line.size, color);
  }
  drawQr(page, qrContent === "VCARD" ? badgeVCard(badge) : badge.barcode, qrColor);
  if (badge.badgeNumber !== null) {
    const text = formatBadgeNumber(badge.badgeNumber);
    page.drawText(text, {
      x: NUMBER.right - fonts.bold.widthOfTextAtSize(text, NUMBER.size),
      y: NUMBER.baseline,
      size: NUMBER.size,
      font: fonts.bold,
      color,
    });
  }
}

function drawSeparator(page: PDFPage, fonts: Fonts, lines: Array<{ text: string; size: number }>) {
  let y = H / 2 + 60;
  for (const { text, size } of lines) {
    drawCentered(page, fonts.bold, text, y, size, hexToRgb(SEPARATOR_COLOR));
    y -= size * 1.6;
  }
}

/**
 * The whole print file, or the preview (#749) when given one sample badge per
 * type: `separators` false leaves out the bin and type separator pages.
 */
export async function renderBadgePdf(
  editionYear: number,
  badges: PrintedBadge[],
  design: BadgeDesign,
  options: { badgesPerBin: number; separators?: boolean },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Badges DevFest Toulouse ${editionYear}`);
  doc.registerFontkit(fontkit);
  // Whole fonts, not subsets: pdf-lib's subsetting drops glyphs of Google
  // Sans (half the letters of a name went missing). ~2 MB each, once per file.
  // No ligatures either: pdf-lib measures letter by letter, and Google Sans's
  // "tt" left a gap in "Charlott e".
  const features = { liga: false, clig: false, dlig: false };
  const bold = await doc.embedFont(await readFile(new URL(BOLD_FONT_FILE, ASSETS)), { features });
  const fonts: Fonts = {
    bold,
    company: COMPANY_FONT_FILE === BOLD_FONT_FILE ? bold : await doc.embedFont(await readFile(new URL(COMPANY_FONT_FILE, ASSETS)), { features }),
  };
  const backgrounds = new Map<string, Background>();
  const backgroundOf = async (type: BadgeType, side: "front" | "back") => {
    const key = `${type}/${side}`;
    let background = backgrounds.get(key);
    if (!background) {
      const own = design.types[type];
      background = await loadBackground(doc, side === "front" ? own.background : own.backBackground, builtInBackground(type, side));
      backgrounds.set(key, background);
    }
    return background;
  };
  const colorOf = (type: BadgeType) => hexToRgb(design.types[type].color);
  const qrColor = hexToRgb(design.qrColor);
  const withSeparators = options.separators ?? true;

  // A badge's front, then its back; a separator's blank back: the file prints
  // recto-verso, so every front stays on an odd page.
  const addBadge = async (badge: PrintedBadge) => {
    const front = doc.addPage(PAGE);
    (await backgroundOf(badge.type, "front"))(front);
    drawBadge(front, badge, fonts, colorOf(badge.type), qrColor, design.qrContent);
    (await backgroundOf(badge.type, "back"))(doc.addPage(PAGE));
  };
  const addSeparator = (lines: Array<{ text: string; size: number }>) => {
    drawSeparator(doc.addPage(PAGE), fonts, lines);
    doc.addPage(PAGE);
  };

  const numbered = badges
    .filter((b) => b.badgeNumber !== null)
    .sort((a, b) => (a.badgeNumber as number) - (b.badgeNumber as number));
  const binOf = (n: number) => Math.floor(n / NUMBERS_PER_BIN);
  const countByBin = new Map<number, number>();
  for (const b of numbered) countByBin.set(binOf(b.badgeNumber as number), (countByBin.get(binOf(b.badgeNumber as number)) ?? 0) + 1);

  let currentBin: number | null = null;
  for (const badge of numbered) {
    const number = badge.badgeNumber as number;
    if (withSeparators && binOf(number) !== currentBin) {
      currentBin = binOf(number);
      const { counter, bin } = slotOfNumber(number);
      const lastNumber = counter * 1000 + bin * 100 + options.badgesPerBin;
      addSeparator([
        { text: `Guichet ${counter}`, size: 36 },
        { text: `Présentoir ${bin}`, size: 36 },
        { text: `Badges ${formatBadgeNumber(lastNumber - options.badgesPerBin + 1)} à ${formatBadgeNumber(lastNumber)}`, size: 16 },
        { text: `${countByBin.get(currentBin)} badges`, size: 14 },
      ]);
    }
    await addBadge(badge);
  }

  const byName = (a: PrintedBadge, b: PrintedBadge) =>
    a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr");
  for (const type of OTHER_TYPES_ORDER) {
    const ofType = badges.filter((b) => b.type === type && b.badgeNumber === null).sort(byName);
    if (ofType.length === 0) continue;
    if (withSeparators) {
      addSeparator([
        { text: BADGE_TYPE_NAMES[type], size: 36 },
        { text: `${ofType.length} badges, par nom`, size: 16 },
      ]);
    }
    for (const badge of ofType) await addBadge(badge);
  }
  return doc.save();
}
