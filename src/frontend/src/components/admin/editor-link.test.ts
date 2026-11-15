import { afterEach, describe, it, expect } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

import { LinkedImage } from "./linked-image";
import { applyLinkHref, currentLinkHref, normalizeLinkHref } from "./editor-link";

// #805 — a link set in the editor could be neither read nor changed.

let editor: Editor;

const LINKED = '<p>Voir <a target="_blank" rel="noopener noreferrer nofollow" href="https://old.example">le programme</a> ici</p>';

function load(content: string) {
  editor = new Editor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), LinkedImage.configure({ inline: false })],
    content,
  });
  return editor;
}

// "Voir " is 5 characters after the paragraph opening (position 1).
const INSIDE_LINK = 1 + 5 + 3;

afterEach(() => editor.destroy());

describe("currentLinkHref (#805)", () => {
  it("should give the address of the link under the cursor", () => {
    load(LINKED).commands.setTextSelection(INSIDE_LINK);

    expect(currentLinkHref(editor)).toBe("https://old.example");
  });

  it("should give nothing outside a link", () => {
    load(LINKED).commands.setTextSelection(2);

    expect(currentLinkHref(editor)).toBe("");
  });

  it("should give the address of a linked image", () => {
    load('<a href="https://partner.example"><img src="/uploads/logo.png"></a>').commands.setNodeSelection(0);

    expect(currentLinkHref(editor)).toBe("https://partner.example");
  });
});

describe("applyLinkHref (#805)", () => {
  it("should change the whole link when the cursor is inside it", () => {
    load(LINKED).commands.setTextSelection(INSIDE_LINK);

    applyLinkHref(editor, "new.example");

    const links = editor.view.dom.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://new.example");
    expect(links[0].textContent).toBe("le programme");
  });

  it("should remove the whole link when the address is emptied", () => {
    load(LINKED).commands.setTextSelection(INSIDE_LINK);

    applyLinkHref(editor, "  ");

    expect(editor.getHTML()).toBe("<p>Voir le programme ici</p>");
  });

  it("should link the selected text", () => {
    load("<p>Voir le programme</p>").commands.setTextSelection({ from: 6, to: 18 });

    applyLinkHref(editor, "https://devfesttoulouse.fr/programme");

    expect(editor.getHTML()).toContain('href="https://devfesttoulouse.fr/programme"');
    expect(editor.view.dom.querySelector("a")?.textContent).toBe("le programme");
  });
});

describe("normalizeLinkHref (#167)", () => {
  it("should prefix a bare domain and leave paths and schemes alone", () => {
    expect(normalizeLinkHref("www.devfest.fr")).toBe("https://www.devfest.fr");
    expect(normalizeLinkHref("/programme")).toBe("/programme");
    expect(normalizeLinkHref("mailto:a@b.fr")).toBe("mailto:a@b.fr");
  });
});
