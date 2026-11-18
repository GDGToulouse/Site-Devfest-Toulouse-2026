import { describe, it, expect, beforeEach } from "vitest";

import { LABEL_FORMATS, labelLayout, readLabelFormat, saveLabelFormat } from "./badge-label";

const roll = LABEL_FORMATS["100x150"];

describe("the help desk's label (#713)", () => {
  beforeEach(() => window.localStorage.clear());

  it("should print a short name at full size", () => {
    expect(labelLayout({ firstName: "Paul", lastName: "Martin", company: "Capitole Cloud" }, roll)).toEqual({
      firstNameMm: 20,
      lastNameMm: 11,
      companyMm: 6,
      qrMm: null,
    });
  });

  it("should put the badge's QR code under the text, smaller on the short roll (#801)", () => {
    const text = { firstName: "Paul", lastName: "Martin", company: null, qrSvg: "<svg/>" };

    expect(labelLayout(text, roll).qrMm).toBe(40);
    expect(labelLayout(text, LABEL_FORMATS["100x100"]).qrMm).toBe(26);
  });

  it("should put the QR code beside the text on the 8 × 5 cm label, leaving the text the rest of the width", () => {
    const small = LABEL_FORMATS["80x50"];
    const text = { firstName: "Marie-Charlotte", lastName: "Martin", company: null };

    const withQr = labelLayout({ ...text, qrSvg: "<svg/>" }, small);
    const withoutQr = labelLayout(text, small);

    expect(withQr.qrMm).toBe(22);
    // 80 mm − 2 × 6 mm margin − 22 mm QR − 3 mm gap = 43 mm for 15 letters.
    expect(withQr.firstNameMm).toBe(4);
    expect(withoutQr.firstNameMm).toBeGreaterThan(withQr.firstNameMm);
  });

  it("should keep a short name on the 8 × 5 cm label within its height", () => {
    const layout = labelLayout({ firstName: "Paul", lastName: "Martin", company: "Capitole Cloud", qrSvg: "<svg/>" }, LABEL_FORMATS["80x50"]);
    // Header, three lines at line-height 1.05 and three 1.5 mm gaps, within 50 − 2 × 6 mm.
    const height = (3 + layout.firstNameMm + layout.lastNameMm + (layout.companyMm ?? 0)) * 1.05 + 3 * 1.5;

    expect(height).toBeLessThanOrEqual(38);
  });

  it("should shrink a long name until it fits on one line, below the old wrapping floor", () => {
    const layout = labelLayout(
      { firstName: "Marie-Charlotte", lastName: "Vandenberghe-Delacroix", company: null },
      roll,
    );

    expect(layout.firstNameMm).toBeLessThan(20);
    // 22 capitals in 84 mm: below the 6 mm the label used to wrap at.
    expect(layout.lastNameMm).toBeLessThan(6);
  });

  it("should size each line on the width the real font measures (#713)", () => {
    // "Clémence" wrapped on a printed 8 × 5 label: the letter count was too optimistic.
    const wide: (text: string) => number = (text) => text.length * 0.8;
    const measure = (text: string) => wide(text);
    const small = LABEL_FORMATS["80x50"];
    const text = { firstName: "Clémence", lastName: "Aubert", company: null, qrSvg: "<svg/>" };

    const layout = labelLayout(text, small, measure);
    const usable = 80 - 2 * small.marginMm - small.qrMm - 3;

    expect(layout.firstNameMm * wide("Clémence")).toBeLessThanOrEqual(usable);
    expect(layout.lastNameMm * wide("AUBERT")).toBeLessThanOrEqual(usable);
  });

  it("should keep a margin of at least 6 mm on every roll", () => {
    expect(Object.values(LABEL_FORMATS).every((format) => format.marginMm >= 6)).toBe(true);
  });

  it("should size an accented name like the same name without accents", () => {
    const accented = labelLayout({ firstName: "Hélène", lastName: "Gaëlle", company: null }, roll);
    // Decomposed accents (NFD, as some keyboards send them) are one letter each.
    const decomposed = labelLayout({ firstName: "Hélène".normalize("NFD"), lastName: "Gaëlle".normalize("NFD"), company: null }, roll);

    expect(decomposed).toEqual(accented);
  });

  it("should leave out the company line when there is none", () => {
    expect(labelLayout({ firstName: "Paul", lastName: "Martin", company: null }, roll).companyMm).toBeNull();
  });

  it("should remember the roll this device prints on", () => {
    saveLabelFormat("100x100");

    expect(readLabelFormat()).toBe(LABEL_FORMATS["100x100"]);
  });

  it("should remember every roll of the catalogue, not only the first two", () => {
    saveLabelFormat("80x50");

    expect(readLabelFormat()).toBe(LABEL_FORMATS["80x50"]);
  });

  it("should fall back to the default roll on an unknown or inherited key", () => {
    window.localStorage.setItem("devfest-arrivals-label-format", "toString");

    expect(readLabelFormat()).toBe(roll);
  });
});
