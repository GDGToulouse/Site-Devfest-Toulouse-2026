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
