import { afterEach, describe, it, expect } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

import { LinkedImage } from "./linked-image";

// #490 — a partner logo in a content page must lead to the partner's site.

let editor: Editor;

function load(content: string) {
  editor = new Editor({
    extensions: [StarterKit, Link, LinkedImage.configure({ inline: false })],
    content,
  });
  return editor;
}

afterEach(() => editor.destroy());

describe("LinkedImage (#490)", () => {
  it("should save a linked image as a link around the image", () => {
    load('<img src="/uploads/logo.png" alt="Emmaüs">');

    editor.chain().setNodeSelection(0).updateAttributes("image", { href: "https://emmaus.example" }).run();

    expect(editor.getHTML()).toBe(
      '<a href="https://emmaus.example" target="_blank" rel="noopener noreferrer"><img src="/uploads/logo.png" alt="Emmaüs"></a>',
    );
  });

  it("should keep the link of a saved image when the page is edited again", () => {
    const saved = '<a href="https://emmaus.example" target="_blank" rel="noopener noreferrer"><img src="/uploads/logo.png"></a>';

    expect(load(saved).getHTML()).toBe(saved);
  });

  it("should save an image without a link as a bare image", () => {
    expect(load('<img src="/uploads/logo.png">').getHTML()).toBe('<img src="/uploads/logo.png">');
  });
});
