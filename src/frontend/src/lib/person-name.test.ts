import { describe, it, expect } from "vitest";

import { formatFirstName, formatLastName } from "./person-name";

// How a name is printed on the help desk's label (#843), as on the badge.

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
