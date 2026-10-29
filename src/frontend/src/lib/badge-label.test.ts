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
    });
  });

  it("should shrink a long name to keep it on one line, down to a readable floor", () => {
    const layout = labelLayout(
      { firstName: "Marie-Charlotte", lastName: "Vandenberghe-Delacroix", company: null },
      roll,
    );

    expect(layout.firstNameMm).toBeLessThan(20);
    expect(layout.firstNameMm).toBeGreaterThanOrEqual(9);
    expect(layout.lastNameMm).toBe(6);
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
});
