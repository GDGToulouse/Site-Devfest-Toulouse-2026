import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { beforeAll, describe, it, expect } from "vitest";

import { badgeVCard, fitLines, layoutBadgeText, plateItems, renderBadgePdf, type PrintedBadge } from "./badge-pdf.js";
import { DEFAULT_BADGE_DESIGN, DEFAULT_QR_COLOR, badgeTypeOf, isBadgeTypeAllowed, readBadgeDesign } from "./badge-design.js";

let bold: PDFFont;
// The text's width on an A6 page, in points: the page less a 20 pt margin each side.
const ZONE_WIDTH = 193;
// Between the type ribbon's lower edge and the QR square's upper edge (#774).
const RIBBON_BOTTOM = 345;
const QR_SQUARE_TOP = 215.433;
const PAGE_WIDTH = 297.638;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  bold = await doc.embedFont(await readFile(new URL("../../assets/fonts/GoogleSans-Bold.ttf", import.meta.url)));
});

const person = (firstName: string, lastName: string, company: string | null): PrintedBadge => ({
  type: "PARTICIPANT",
  badgeNumber: 1225,
  firstName,
  lastName,
  company,
  barcode: "1234567890",
});

describe("the badge's text (#639)", () => {
  it("should keep a short name on one line at full size", () => {
    expect(fitLines(bold, "Paul", ZONE_WIDTH, { max: 30, min: 16, maxLines: 2 })).toEqual({ lines: ["Paul"], size: 30 });
  });

  it("should break a long hyphenated first name over two lines, within the zone", () => {
    const fitted = fitLines(bold, "Marie-Charlotte-Eugénie", ZONE_WIDTH, { max: 30, min: 16, maxLines: 2 });

    expect(fitted.lines).toHaveLength(2);
    expect(fitted.lines[0].endsWith("-")).toBe(true);
    expect(fitted.lines.every((l) => bold.widthOfTextAtSize(l, fitted.size) <= ZONE_WIDTH)).toBe(true);
  });

  it("should shrink below the floor rather than overflow when even that is not enough", () => {
    const fitted = fitLines(bold, "VANDENBERGHEDELACROIXMONTMORENCY", ZONE_WIDTH, { max: 24, min: 12, maxLines: 1 });

    expect(bold.widthOfTextAtSize(fitted.lines[0], fitted.size)).toBeLessThanOrEqual(ZONE_WIDTH + 0.01);
  });

  it("should put name and company in the vCard, never more, separators escaped", () => {
    const card = badgeVCard({ firstName: "Léa", lastName: "Martin", company: "Dupont, Durand; Associés" });

    expect(card).toContain("N:Martin;Léa;;;");
    expect(card).toContain("ORG:Dupont\\, Durand\\; Associés");
    expect(card).not.toContain("EMAIL");
  });

  it("should print the type each tier chose, within its flow", () => {
    expect(badgeTypeOf({ isOutsideFlow: false, badgeType: "SPONSOR", nameFr: "Pass" })).toBe("SPONSOR");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: "STAFF", nameFr: "Pass" })).toBe("STAFF");
    expect(isBadgeTypeAllowed(false, "SPEAKER")).toBe(false);
    expect(isBadgeTypeAllowed(true, "PARTICIPANT")).toBe(false);
  });

  it("should guess the type from the tier's name when none is set, or when it does not fit the flow", () => {
    expect(badgeTypeOf({ isOutsideFlow: false, badgeType: "SPEAKER", nameFr: "Sponsor et partenaire" })).toBe("SPONSOR");
    expect(badgeTypeOf({ isOutsideFlow: false, badgeType: null, nameFr: "Plein tarif" })).toBe("PARTICIPANT");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: null, nameFr: "Staff" })).toBe("STAFF");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: null, nameFr: "Bénévole" })).toBe("VOLUNTEER");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: null, nameFr: "Prestataire" })).toBe("CONTRACTOR");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: null, nameFr: "Speaker" })).toBe("SPEAKER");
  });
});

describe("a design stored before V3 (#774)", () => {
  it("should be completed with the built-in back, QR colour and new types", () => {
    const design = readBadgeDesign({
      qrContent: "VCARD",
      types: { PARTICIPANT: { background: "/uploads/fond.png", color: "#123456" } },
    });

    expect(design.qrContent).toBe("VCARD");
    expect(design.qrColor).toBe(DEFAULT_QR_COLOR);
    expect(design.types.PARTICIPANT).toEqual({ background: "/uploads/fond.png", backBackground: null, color: "#123456", blanks: 1 });
    expect(design.types.SPONSOR).toEqual(DEFAULT_BADGE_DESIGN.types.SPONSOR);
  });

  it("should reset the old default dark text to white", () => {
    const design = readBadgeDesign({ qrContent: "TICKET", types: { SPEAKER: { background: null, color: "#683d91" } } });

    expect(design.types.SPEAKER.color).toBe("#FFFFFF");
  });
});

describe("the badge's text geometry (#774)", () => {
  const fonts = () => ({ bold, company: bold });
  const people = [
    person("Paul", "Martin", "GDG"),
    person("Marie-Charlotte-Eugénie", "Vandenberghe-Delacroix-Montmorency", "Capitole Cloud Engineering & Data Platform Services"),
    person("Jean-Baptiste Alexandre Maximilien", "Saint-Exupéry de la Rochefoucauld", "Aéronova Systèmes Embarqués Toulouse"),
    person("Hélène", "Ó Súilleabháin", null),
    person("Thị Ngọc Anh", "Nguyễn", "Société Générale de Transport Aérien Régional Occitanie"),
  ];

  it("should put a short name on the designer's baselines, centred", () => {
    const { lines } = layoutBadgeText(fonts(), people[0]);

    expect(lines.map((l) => [l.role, l.size, Number(l.y.toFixed(2))])).toEqual([
      ["first", 36, 305.77],
      ["last", 24, 273.5],
      ["company", 16, 245.4],
    ]);
  });

  it.each(people.map((p) => [`${p.firstName} ${p.lastName}`, p] as const))(
    "should keep %s between the ribbon and the QR square, within the margins",
    (_name, badge) => {
      const { lines, top, bottom } = layoutBadgeText(fonts(), badge);

      expect(top).toBeLessThanOrEqual(RIBBON_BOTTOM);
      expect(bottom).toBeGreaterThanOrEqual(QR_SQUARE_TOP);
      for (const line of lines) {
        const width = bold.widthOfTextAtSize(line.text, line.size) + line.tracking * line.size * (line.text.length - 1);
        expect(width).toBeLessThanOrEqual(PAGE_WIDTH - 40 + 0.01);
      }
    },
  );

  it("should print the first name with capital initials and the last name in capitals (#843)", () => {
    const { lines } = layoutBadgeText(fonts(), person("jEAN-pierre", "de la fontaine", "GDG"));

    expect(lines.filter((l) => l.role !== "company").map((l) => l.text)).toEqual(["Jean-Pierre", "DE LA FONTAINE"]);
  });

  it("should keep the lines in order, none over the next", () => {
    const { lines } = layoutBadgeText(fonts(), people[1]);

    const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y);
    expect(gaps.every((gap) => gap > 0)).toBe(true);
  });
});

describe("the print file's recto-verso (#774)", () => {
  it("should follow every front and every separator with a back page", async () => {
    const badges: PrintedBadge[] = [
      person("Léa", "Martin", "GDG"),
      { ...person("Tom", "Durand", null), type: "SPONSOR", badgeNumber: 2101 },
      { ...person("Eve", "Roux", null), type: "SPEAKER", badgeNumber: null },
    ];

    const pdf = await PDFDocument.load(await renderBadgePdf(2026, badges, DEFAULT_BADGE_DESIGN, { badgesPerBin: 99 }));

    // Two bin separators and the speakers' one, three badges: six pages' worth of fronts and as many backs.
    expect(pdf.getPageCount()).toBe(12);
  });
});

describe("blank badges (#841)", () => {
  const withBlanks = (counts: Partial<Record<"PARTICIPANT" | "SPEAKER" | "VOLUNTEER", number>>) => ({
    ...DEFAULT_BADGE_DESIGN,
    types: Object.fromEntries(
      Object.entries(DEFAULT_BADGE_DESIGN.types).map(([type, own]) => [type, { ...own, blanks: counts[type as keyof typeof counts] ?? 0 }]),
    ) as typeof DEFAULT_BADGE_DESIGN.types,
  });

  it("should add each type's blank badges, front and back, after a separator", async () => {
    const pdf = await PDFDocument.load(
      await renderBadgePdf(2026, [], withBlanks({ SPEAKER: 2, VOLUNTEER: 1 }), { badgesPerBin: 99, blanks: true }),
    );

    // Two separators with their backs, three blank badges with theirs.
    expect(pdf.getPageCount()).toBe(10);
  });

  it("should give the blank badges alone without their separators", async () => {
    const pdf = await PDFDocument.load(
      await renderBadgePdf(2026, [], withBlanks({ PARTICIPANT: 3 }), { badgesPerBin: 99, blanks: true, separators: false }),
    );

    expect(pdf.getPageCount()).toBe(6);
  });

  it("should leave them out of a file that does not ask for them, the preview's", async () => {
    const speaker: PrintedBadge = { ...person("Eve", "Roux", null), type: "SPEAKER", badgeNumber: null };

    const pdf = await PDFDocument.load(
      await renderBadgePdf(2026, [speaker], withBlanks({ SPEAKER: 5 }), { badgesPerBin: 99, separators: false }),
    );

    expect(pdf.getPageCount()).toBe(2);
  });
});

describe("the printer's A4 plates (#846)", () => {
  const designWith = (blanks: Partial<Record<string, number>>) => ({
    ...DEFAULT_BADGE_DESIGN,
    types: Object.fromEntries(
      Object.entries(DEFAULT_BADGE_DESIGN.types).map(([type, own]) => [type, { ...own, blanks: blanks[type] ?? 1 }]),
    ) as typeof DEFAULT_BADGE_DESIGN.types,
  });
  const numbered = (n: number, type: "PARTICIPANT" | "SPONSOR" = "PARTICIPANT"): PrintedBadge => ({
    ...person(`P${n}`, `N${n}`, null),
    type,
    badgeNumber: n,
  });
  const describePlate = (plate: ReturnType<typeof plateItems>[number]) =>
    plate.map((item) => (item.badge ? `${item.type}:${item.badge.badgeNumber ?? item.badge.lastName}` : `${item.type}:blank`));

  it("should put four badges of one type on each plate, participants then sponsors in number order", () => {
    const plates = plateItems([numbered(2101, "SPONSOR"), numbered(1102), numbered(1100), numbered(1101)], designWith({}));

    expect(plates.slice(0, 2).map(describePlate)).toEqual([
      ["PARTICIPANT:1100", "PARTICIPANT:1101", "PARTICIPANT:1102", "PARTICIPANT:blank"],
      ["SPONSOR:2101", "SPONSOR:blank", "SPONSOR:blank", "SPONSOR:blank"],
    ]);
  });

  it("should print at least the blank badges set, then up to three more to fill the last plate", () => {
    const people = Array.from({ length: 5 }, (_, i) => numbered(1100 + i));

    const participants = plateItems(people, designWith({ PARTICIPANT: 2 })).filter((p) => p[0].type === "PARTICIPANT");

    // 5 badges + 2 blanks = 7, padded to 8 with one more blank.
    expect(participants.flat().filter((item) => item.badge === null)).toHaveLength(3);
    expect(participants).toHaveLength(2);
  });

  it("should give a type without any ticket one plate of four blank badges", () => {
    const plates = plateItems([], designWith({}));

    expect(plates).toHaveLength(6);
    expect(plates.every((plate) => plate.length === 4 && plate.every((item) => item.badge === null))).toBe(true);
  });

  it("should sort the dedicated types by name, in their usual order", () => {
    const speaker = (last: string): PrintedBadge => ({ ...person("A", last, null), type: "SPEAKER", badgeNumber: null });

    const plates = plateItems([speaker("Roux"), speaker("Abel")], designWith({}));

    expect(plates.map((plate) => plate[0].type)).toEqual(["PARTICIPANT", "SPONSOR", "STAFF", "SPEAKER", "VOLUNTEER", "CONTRACTOR"]);
    expect(describePlate(plates[3]).slice(0, 2)).toEqual(["SPEAKER:Abel", "SPEAKER:Roux"]);
  });

  it("should render each plate as an A4 front page and an A4 back page", async () => {
    const pdf = await PDFDocument.load(await renderBadgePdf(2026, [numbered(1100)], designWith({}), { badgesPerBin: 100, format: "a4" }));

    expect(pdf.getPageCount()).toBe(12);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 595.276, height: 841.89 });
  });

  it("should read a design stored with no blank badge as one of each type", () => {
    const design = readBadgeDesign({ types: { SPEAKER: { blanks: 0 } } });

    expect(design.types.SPEAKER.blanks).toBe(1);
  });
});
