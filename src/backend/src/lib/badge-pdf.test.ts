import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { beforeAll, describe, it, expect } from "vitest";

import { badgeVCard, fitLines } from "./badge-pdf.js";
import { badgeTypeOf } from "./badge-design.js";

let bold: PDFFont;
// The light zone's inner width on an A6 page, in points.
const ZONE_WIDTH = 193;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  bold = await doc.embedFont(await readFile(new URL("../../assets/fonts/GoogleSans-Bold.ttf", import.meta.url)));
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

  it("should print a participant badge for every tier through the counters, sponsors included", () => {
    expect(badgeTypeOf({ isOutsideFlow: false, badgeType: "SPEAKER", nameFr: "Sponsor et partenaire" })).toBe("PARTICIPANT");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: null, nameFr: "Bénévole" })).toBe("VOLUNTEER");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: null, nameFr: "Prestataire" })).toBe("CONTRACTOR");
    expect(badgeTypeOf({ isOutsideFlow: true, badgeType: null, nameFr: "Speaker" })).toBe("SPEAKER");
  });
});
