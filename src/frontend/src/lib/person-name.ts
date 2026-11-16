// How a name is printed on the help desk's label (#843), as on the badge:
// whatever was typed — "jean", "JEAN", "marie-claire", "de la fontaine" — the first
// name gets a capital initial on each of its parts and the last name is all
// capitals. Printing only: the stored names are left as typed. The badge PDF
// keeps the same rule (src/backend/src/lib/person-name.ts): the two apps share no code.

const LOCALE = "fr-FR";

/** "jEAN-pierre" → "Jean-Pierre", "élodie" → "Élodie": a capital after each space or hyphen. */
export function formatFirstName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase(LOCALE)
    .replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase(LOCALE));
}

/** "de la Fontaine" → "DE LA FONTAINE", accents kept: "LEFÈVRE". */
export function formatLastName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase(LOCALE);
}
