import type { Editor } from "@tiptap/react";

// Prefix https:// when the user types a bare domain (e.g. "www.devfest.fr"),
// otherwise the browser treats it as a relative link and it 404s (#167).
// Leave absolute URLs and mailto:/tel: links untouched, and don't touch
// in-page anchors (#...) or root-relative paths (/...).
export function normalizeLinkHref(href: string): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return href;
  return `https://${href}`;
}

/** The address of the link under the cursor (text or image), or "". */
export function currentLinkHref(editor: Editor): string {
  if (editor.isActive("image")) return editor.getAttributes("image").href || "";
  return editor.getAttributes("link").href || "";
}

/**
 * Sets, changes or (empty url) removes the link under the cursor. A text link
 * is taken whole: with the cursor inside it, only the cursor would change
 * otherwise, and the link would split in two (#805).
 */
export function applyLinkHref(editor: Editor, url: string): void {
  const trimmed = url.trim();
  if (editor.isActive("image")) {
    // An image carries its link as an attribute: the link mark cannot apply
    // to a block node (#490). An empty URL removes it.
    editor.chain().focus().updateAttributes("image", { href: trimmed ? normalizeLinkHref(trimmed) : null }).run();
  } else if (trimmed) {
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizeLinkHref(trimmed) }).run();
  } else {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }
}
