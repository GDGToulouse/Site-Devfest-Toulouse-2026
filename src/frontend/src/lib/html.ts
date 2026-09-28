// Small HTML helpers shared by pages that render rich text (#270).

// True when a string carries HTML tags. Descriptions saved before the WYSIWYG
// switch are plain text with newlines; new ones are Tiptap HTML. This lets a
// page render each correctly without a data migration.
export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

// Strips tags and collapses whitespace, for meta descriptions / OG tags where
// only plain text belongs. Entities are left as-is (good enough for meta).
export function htmlToText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Google asks paid links to be qualified as sponsored (#495): every outbound
// link a sponsor gets from the site carries this rel.
export const SPONSORED_LINK_REL = "sponsored noopener noreferrer";

const ANCHOR_TAG = /<a\b[^>]*>/gi;
const EXTERNAL_HREF = /\shref="https?:\/\//i;
const REL_ATTRIBUTE = /\srel="[^"]*"/i;

// Marks the outbound links of a sponsor's rich text as sponsored. Done at render
// rather than in the backend's sanitizeRichHtml: that one is shared with
// articles and pages, where a link is no partnership, and it rewrites rel on
// every save. Its output has double-quoted attributes, so a tag-level regex
// is enough. Links inside the site (/…, #…) and mailto/tel are left alone.
export function markLinksSponsored(html: string): string {
  return html.replace(ANCHOR_TAG, (tag) => {
    if (!EXTERNAL_HREF.test(tag)) return tag;
    const rel = ` rel="${SPONSORED_LINK_REL}"`;
    return REL_ATTRIBUTE.test(tag) ? tag.replace(REL_ATTRIBUTE, rel) : tag.replace(/>$/, `${rel}>`);
  });
}
