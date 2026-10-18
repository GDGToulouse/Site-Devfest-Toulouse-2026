// Small HTML helpers shared by pages that render rich text (#270).

// True when a string carries HTML tags. Descriptions saved before the WYSIWYG
// switch are plain text with newlines; new ones are Tiptap HTML. This lets a
// page render each correctly without a data migration.
export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// The entities the backend's sanitizer writes (`&amp;`, `&lt;`, `&gt;`) plus the
// ones a pasted text carries: the named few above and numeric references. Any
// other name is left as it came rather than guessed at.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

// Strips tags, decodes entities and collapses whitespace, for meta descriptions
// / OG tags and text rendered by React, where only plain text belongs. Tags go
// first: decoded text such as "&lt;b&gt;" must stay text, not become a tag to
// strip. Decoded once: the sanitizer escapes a "&" as "&amp;" and nothing else.
export function htmlToText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// Google asks paid links to be qualified as sponsored (#495): every outbound
// link a sponsor gets from the site carries this rel.
export const SPONSORED_LINK_REL = "sponsored noopener noreferrer";

const ANCHOR_TAG = /<a\b[^>]*>/gi;
// Protocol-relative //host counts too: sanitizeRichHtml lets it through as is.
const EXTERNAL_HREF = /\shref="(?:https?:)?\/\//i;
const REL_ATTRIBUTE = /\srel="[^"]*"/i;

// Marks the outbound links of a sponsor's rich text as sponsored. Done at render
// rather than in the backend's sanitizeRichHtml: that one is shared with
// articles and pages, where a link is no partnership, and it rewrites rel on
// every save. Its output has double-quoted attributes, so a tag-level regex
// is enough. Links inside the site (/path, #anchor) and mailto/tel are left alone.
export function markLinksSponsored(html: string): string {
  return html.replace(ANCHOR_TAG, (tag) => {
    if (!EXTERNAL_HREF.test(tag)) return tag;
    const rel = ` rel="${SPONSORED_LINK_REL}"`;
    return REL_ATTRIBUTE.test(tag) ? tag.replace(REL_ATTRIBUTE, rel) : tag.replace(/>$/, `${rel}>`);
  });
}
