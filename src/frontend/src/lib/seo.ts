const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/**
 * Serialise a JSON-LD object for injection into a <script> tag.
 *
 * `JSON.stringify` leaves `<` untouched, so a value containing `</script>`
 * closes the tag early and everything after it is parsed as HTML — stored XSS.
 * That is reachable: a speaker editing their own profile through a magic link
 * can set `company`, which feeds `worksFor` here, and it is length-capped but
 * never sanitised.
 *
 * Escaping `<`, `>` and `&` as unicode sequences keeps the JSON semantically
 * identical (the parser resolves them back) while making the string incapable
 * of terminating the element.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// Schema.org expects absolute URLs. Uploaded assets are stored as /uploads/…,
// so they need the site origin prepended before they go into JSON-LD (#185).
// Speaker photos imported from 2016-2019 are hosted on third-party domains and
// are already absolute — those pass through untouched (#356, #465).
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${BASE_URL}${path}`;
}

/**
 * Whether an Event carries the two fields Google requires of one (#464).
 *
 * Both are optional in the database — an edition in preparation legitimately
 * has neither a date nor a venue yet — while both builders emit them as
 * `?? undefined`. That combination produces an Event missing a required field,
 * which is precisely the pair Search Console reports: "champ startDate
 * manquant", "champ location manquant".
 *
 * The answer is to emit nothing at all. No rich result costs nothing; an
 * invalid one is a critical error on the report. A placeholder would be worse
 * still — Google penalises structured data that does not match what the page
 * shows.
 *
 * One function rather than the same condition written in two pages: it is one
 * rule, and it has one reason to change (what Google requires).
 */
export function isCompleteEvent(event: { startDate?: string; location?: unknown }): boolean {
  return Boolean(event.startDate && event.location);
}

/**
 * The locale a single-language entity canonicalises to (#468).
 *
 * `Talk.language` is a plain `String` in the schema. A value the site cannot
 * serve is read as "no opinion" and leaves the page bilingual, rather than
 * canonicalising it to a URL that does not exist. Every talk carries "fr" or
 * "en" today — the historical import normalises to those two — so this guards
 * a future data drift, not a current case.
 *
 * Here rather than beside `pageMetadata`, which the sitemap must not import:
 * that module reaches for `next-intl/server`, and the sitemap has no request
 * locale to give it.
 */
export function canonicalLocaleFor(language: string | null | undefined): string | undefined {
  return language === "fr" || language === "en" ? language : undefined;
}
