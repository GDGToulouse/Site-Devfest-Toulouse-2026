// How a name is printed on a badge (#843): whatever the attendee typed on
// Billetweb — "jean", "JEAN", "marie-claire", "de la fontaine" — the first
// name gets a capital initial on each of its parts and the last name is all
// capitals. Printing only: the stored names are left as typed. The frontend
// keeps the same rule for the help desk's label (src/frontend/src/lib/person-name.ts).

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
