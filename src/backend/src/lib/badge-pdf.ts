import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";

import type { BadgeType } from "../generated/prisma/client.js";
import { NUMBERS_PER_BIN, slotOfNumber } from "./badge-numbering.js";
import { BADGE_TYPE_NAMES, type BadgeDesign } from "./badge-design.js";
import { UPLOADS_DIR } from "./image-store.js";

// The print file (RG-ARR-19, #639): one A6 page per badge on the type's
// background, the person written in the light zone every design shares.
// Participants come first, in number order with a separator page before each
// bin; then the other badges, by type and name. Positions are fractions of
// the page, measured on the 2026 working design.

const PAGE: [number, number] = [297.64, 419.53];
const [W, H] = PAGE;
// The light zone, and the margin kept inside it.
const ZONE = { left: 0.1412 * W, right: 0.8574 * W, top: H * (1 - 0.189), bottom: H * (1 - 0.5614) };
const ZONE_PAD = 10;
const QR = { left: 0.166 * W, top: H * (1 - 0.405), side: 0.176 * W };
const COMPANY = { left: 0.386 * W, firstBaseline: H * (1 - 0.44) };
const FIRST_NAME_BASELINE = H * (1 - 0.262);
// The number's white space, top right: participants only.
const NUMBER_BOX = { width: 0.3 * W, height: 0.075 * H, right: W - 0.05 * W, top: H * (1 - 0.03) };
// A6 at 300 dpi, for a vector background turned into an image.
const BACKGROUND_PIXELS = { width: 1240, height: 1748 };

const ASSETS = new URL("../../assets/", import.meta.url);
const OTHER_TYPES_ORDER: BadgeType[] = ["SPEAKER", "VOLUNTEER", "CONTRACTOR"];

export interface PrintedBadge {
  type: BadgeType;
  /** Participants only. */
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
  { max, min, maxLines }: { max: number; min: number; maxLines: number },
): { lines: string[]; size: number } {
  const text = printable(font, raw.trim());
  // Break after a space or a hyphen, keeping the hyphen on its line.
  const words = text.split(/(?<=[\s-])/).filter((w) => w.trim().length > 0);
  const wrap = (size: number) => {
    const lines: string[] = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last !== undefined && font.widthOfTextAtSize(last + word, size) <= width) lines[lines.length - 1] = last + word;
      else lines.push(word);
    }
    return lines.map((l) => l.trimEnd());
  };
  const fits = (lines: string[], size: number, count: number) =>
    lines.length <= count && lines.every((l) => font.widthOfTextAtSize(l, size) <= width);
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
  const widest = Math.max(...kept.map((l) => font.widthOfTextAtSize(l, min)));
  return { lines: kept, size: Math.min(min, (min * width) / widest) };
}

function drawCentered(page: PDFPage, font: PDFFont, text: string, y: number, size: number, color: RGB, from = 0, to = W) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: from + (to - from - width) / 2, y, size, font, color });
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
          y: QR.top - (row + 1) * cell,
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
async function loadBackground(doc: PDFDocument, uploadPath: string | null): Promise<Background> {
  const file = uploadPath
    ? path.join(UPLOADS_DIR, path.basename(uploadPath))
    : new URL("badges/default-background.png", ASSETS);
  const bytes = await readFile(file);
  const extension = uploadPath ? path.extname(uploadPath).toLowerCase() : ".png";
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
  medium: PDFFont;
}

function drawBadge(page: PDFPage, badge: PrintedBadge, fonts: Fonts, color: RGB, qrContent: BadgeDesign["qrContent"]) {
  const zoneWidth = ZONE.right - ZONE.left - 2 * ZONE_PAD;
  const first = fitLines(fonts.bold, badge.firstName, zoneWidth, { max: 30, min: 16, maxLines: 2 });
  // Two lines of first name leave room for one of last name above the QR code.
  const last = fitLines(fonts.bold, badge.lastName.toUpperCase(), zoneWidth, {
    max: 24,
    min: 12,
    maxLines: first.lines.length > 1 ? 1 : 2,
  });
  let y = FIRST_NAME_BASELINE;
  first.lines.forEach((line, i) => {
    if (i > 0) y -= first.size * 1.1;
    drawCentered(page, fonts.bold, line, y, first.size, color, ZONE.left, ZONE.right);
  });
  last.lines.forEach((line, i) => {
    y -= i === 0 ? last.size * 1.2 : last.size * 1.1;
    drawCentered(page, fonts.bold, line, y, last.size, color, ZONE.left, ZONE.right);
  });

  drawQr(page, qrContent === "VCARD" ? badgeVCard(badge) : badge.barcode, color);

  if (badge.company) {
    const company = fitLines(fonts.medium, badge.company, ZONE.right - ZONE_PAD - COMPANY.left, {
      max: 16,
      min: 9,
      maxLines: 3,
    });
    company.lines.forEach((line, i) => {
      page.drawText(line, {
        x: COMPANY.left,
        y: COMPANY.firstBaseline - i * company.size * 1.15,
        size: company.size,
        font: fonts.medium,
        color,
      });
    });
  }

  if (badge.badgeNumber !== null) {
    const x = NUMBER_BOX.right - NUMBER_BOX.width;
    const boxY = NUMBER_BOX.top - NUMBER_BOX.height;
    page.drawRectangle({ x, y: boxY, width: NUMBER_BOX.width, height: NUMBER_BOX.height, color: rgb(1, 1, 1) });
    const size = 24;
    // Capitals and digits stand about 0.7 of the size: centred on that.
    drawCentered(page, fonts.bold, String(badge.badgeNumber), boxY + (NUMBER_BOX.height - size * 0.7) / 2, size, color, x, NUMBER_BOX.right);
  }
}

function drawSeparator(page: PDFPage, fonts: Fonts, color: RGB, lines: Array<{ text: string; size: number }>) {
  let y = H / 2 + 60;
  for (const { text, size } of lines) {
    drawCentered(page, fonts.bold, text, y, size, color);
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
  const fonts: Fonts = {
    bold: await doc.embedFont(await readFile(new URL("fonts/GoogleSans-Bold.ttf", ASSETS)), { features }),
    medium: await doc.embedFont(await readFile(new URL("fonts/GoogleSans-Medium.ttf", ASSETS)), { features }),
  };
  const backgrounds = new Map<BadgeType, Background>();
  const backgroundOf = async (type: BadgeType) => {
    let background = backgrounds.get(type);
    if (!background) {
      background = await loadBackground(doc, design.types[type].background);
      backgrounds.set(type, background);
    }
    return background;
  };
  const colorOf = (type: BadgeType) => hexToRgb(design.types[type].color);
  const withSeparators = options.separators ?? true;

  const participants = badges
    .filter((b) => b.type === "PARTICIPANT" && b.badgeNumber !== null)
    .sort((a, b) => (a.badgeNumber as number) - (b.badgeNumber as number));
  const binOf = (n: number) => Math.floor(n / NUMBERS_PER_BIN);
  const countByBin = new Map<number, number>();
  for (const b of participants) countByBin.set(binOf(b.badgeNumber as number), (countByBin.get(binOf(b.badgeNumber as number)) ?? 0) + 1);

  let currentBin: number | null = null;
  for (const badge of participants) {
    const number = badge.badgeNumber as number;
    if (withSeparators && binOf(number) !== currentBin) {
      currentBin = binOf(number);
      const { counter, bin } = slotOfNumber(number);
      const firstNumber = counter * 1000 + bin * 100;
      drawSeparator(doc.addPage(PAGE), fonts, colorOf("PARTICIPANT"), [
        { text: `Guichet ${counter}`, size: 36 },
        { text: `Bac ${bin}`, size: 36 },
        { text: `Badges ${firstNumber} à ${firstNumber + options.badgesPerBin - 1}`, size: 16 },
        { text: `${countByBin.get(currentBin)} badges`, size: 14 },
      ]);
    }
    const page = doc.addPage(PAGE);
    (await backgroundOf("PARTICIPANT"))(page);
    drawBadge(page, badge, fonts, colorOf("PARTICIPANT"), design.qrContent);
  }

  const byName = (a: PrintedBadge, b: PrintedBadge) =>
    a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr");
  for (const type of OTHER_TYPES_ORDER) {
    const ofType = badges.filter((b) => b.type === type).sort(byName);
    if (ofType.length === 0) continue;
    if (withSeparators) {
      drawSeparator(doc.addPage(PAGE), fonts, colorOf(type), [
        { text: BADGE_TYPE_NAMES[type], size: 36 },
        { text: `${ofType.length} badges, par nom`, size: 16 },
      ]);
    }
    for (const badge of ofType) {
      const page = doc.addPage(PAGE);
      (await backgroundOf(type))(page);
      drawBadge(page, { ...badge, badgeNumber: null }, fonts, colorOf(type), design.qrContent);
    }
  }
  return doc.save();
}
