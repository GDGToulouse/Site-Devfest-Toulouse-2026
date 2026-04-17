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
    a: ["href", "title", "target"],
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
  // Force target=_blank links to carry safe rel attributes.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, false),
  },
  // Strip entirely (don't keep text content) for clearly malicious tags.
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
};

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
