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
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${BASE_URL}${path}`;
}
