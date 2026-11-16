import { describe, it, expect } from "vitest";

import { formatFirstName, formatLastName } from "./person-name.js";

// How a name is printed on a badge (#843).

describe("formatFirstName", () => {
  it.each([
    ["jean", "Jean"],
    ["JEAN", "Jean"],
    ["jEAN-pierre", "Jean-Pierre"],
    ["marie claire", "Marie Claire"],
    ["élodie", "Élodie"],
    ["  anne   sophie ", "Anne Sophie"],
  ])("should print %s as %s", (typed, printed) => {
    expect(formatFirstName(typed)).toBe(printed);
  });
});

describe("formatLastName", () => {
  it.each([
    ["Dupont", "DUPONT"],
    ["de la fontaine", "DE LA FONTAINE"],
    ["Lefèvre", "LEFÈVRE"],
    ["d'Alembert", "D'ALEMBERT"],
  ])("should print %s as %s", (typed, printed) => {
    expect(formatLastName(typed)).toBe(printed);
  });
});
