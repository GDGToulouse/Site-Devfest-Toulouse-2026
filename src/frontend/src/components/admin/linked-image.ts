import ImageBase from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/react";
import type { DOMOutputSpec } from "@tiptap/pm/model";

// The editor's image node. A block node cannot carry the link mark, which
// only applies to inline content, so an image link lives on the image itself
// as `href` and renders as `<a href><img></a>`: partner logos that lead to
// their sites (#490). The link opens in a new tab, like text links.
export const LinkedImage = ImageBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-align": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes) => {
          if (!attributes["data-align"]) return {};
          return { "data-align": attributes["data-align"] };
        },
      },
      href: {
        default: null,
        parseHTML: (element) => element.closest("a")?.getAttribute("href") ?? null,
        // Rendered on the wrapping <a> below, never on the <img>.
        renderHTML: () => ({}),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const img: DOMOutputSpec = ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
    if (!node.attrs.href) return img;
    return ["a", { href: node.attrs.href, target: "_blank", rel: "noopener noreferrer" }, img];
  },
});
