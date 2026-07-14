import sanitizeHtml from "sanitize-html";

/**
 * Allowlist-based HTML sanitization for rich text stored from the admin UI
 * (TipTap editor). Applied server-side before write so the database never
 * holds anything unsafe — the front-office can then render with
 * `dangerouslySetInnerHTML` without downstream sanitization.
 *
 * The allowlist intentionally tracks what TipTap produces by default
 * (paragraphs, headings, lists, blockquote, code, links, images, hr, mark).
 * Anything else (script, iframe, form, on* handlers, style, data URIs) is
 * dropped. Links get rel=noopener noreferrer automatically.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "code", "pre",
    "a", "img",
    "hr", "mark",
    "span", "div",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "data-align"],
    "*": ["class"],
  },
  // Only safe URL schemes for href/src. Blocks javascript:, data:, vbscript:
  // and other exotic schemes that can carry executable content.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  transformTags: {
    // Force safe rel on every link, and prefix https:// on schemeless hrefs
    // (e.g. "www.devfest.fr") so they don't render as broken relative links
    // (#167). In-page anchors (#…) and root-relative paths (/…) are left as is.
    a: (tagName, attribs) => {
      const href = attribs.href;
      const normalizedHref =
        href && !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href) ? `https://${href}` : href;
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(normalizedHref ? { href: normalizedHref } : {}),
          rel: "noopener noreferrer",
        },
      };
    },
  },
  // Strip entirely (don't keep text content) for clearly malicious tags.
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
};

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}

/**
 * Allowlist check for a standalone URL field (photoUrl, logoUrl, websiteUrl,
 * social links) — the plain-string counterpart of the scheme allowlist applied
 * to rich HTML above. These values end up in `href`/`src` on public pages, so a
 * `javascript:` or `data:` URL would be an XSS vector (#223).
 *
 * Site-relative paths (`/uploads/...`) are accepted: that is what our own
 * upload pipeline stores. A schemeless value ("www.example.com") is rejected
 * rather than silently coerced — the caller decides what to tell the user.
 */
const SAFE_URL_SCHEMES = ["http:", "https:"];

export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//"); // protocol-relative bypasses the scheme check
  try {
    return SAFE_URL_SCHEMES.includes(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}
