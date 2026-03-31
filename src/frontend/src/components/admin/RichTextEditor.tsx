"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageBase from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import ImagePickerDialog from "./ImagePickerDialog";

const Image = ImageBase.extend({
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
    };
  },
});

interface RichTextEditorProps {
  label: string;
  name: string;
  value: string;
  onChange: (html: string) => void;
  required?: boolean;
  placeholder?: string;
  minHeight?: string;
  showImageButton?: boolean;
}

export default function RichTextEditor({
  label,
  name,
  value,
  onChange,
  required,
  placeholder = "Ecrivez le contenu ici...",
  minHeight = "280px",
  showImageButton = true,
}: RichTextEditorProps) {
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4, 5],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Underline,
      Highlight,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-content",
      },
    },
  });

  // Sync external value changes (e.g. async API load)
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const currentHtml = editor.getHTML();
      if (currentHtml !== value) {
        editor.commands.setContent(value, false);
      }
    }
  }, [editor, value]);

  function handleImageSelect(url: string) {
    if (editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }

  return (
    <div>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-noir mb-1">
          {label}
          {required && <span className="text-terre-cuite ml-1">*</span>}
        </label>
      )}
      <div className="rounded-lg border border-gris/30 bg-blanc focus-within:ring-2 focus-within:ring-malachite/50 focus-within:border-malachite overflow-hidden">
        <Toolbar
          editor={editor}
          onImageClick={showImageButton ? () => setImagePickerOpen(true) : undefined}
        />
        <div style={{ minHeight }}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {showImageButton && (
        <ImagePickerDialog
          open={imagePickerOpen}
          onClose={() => setImagePickerOpen(false)}
          onSelect={handleImageSelect}
        />
      )}
    </div>
  );
}

// --- Toolbar ---

import type { Editor } from "@tiptap/react";

function Toolbar({
  editor,
  onImageClick,
}: {
  editor: Editor | null;
  onImageClick?: () => void;
}) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  if (!editor) return null;

  function applyLink() {
    if (!editor) return;
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }

  function handleLinkClick() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      const existing = editor.getAttributes("link").href || "";
      setLinkUrl(existing);
      setShowLinkInput(true);
    }
  }

  const btnBase = "px-2 py-1 rounded text-sm font-medium transition-colors";
  const btnActive = "bg-malachite/10 text-malachite";
  const btnInactive = "text-gris hover:text-noir hover:bg-gris/10";

  function btnClass(active: boolean) {
    return `${btnBase} ${active ? btnActive : btnInactive}`;
  }

  return (
    <div className="border-b border-gris/20 bg-blanc-casse/50">
      <div className="flex gap-1 flex-wrap p-2">
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={`${btnBase} ${btnInactive} disabled:opacity-30`}
          title="Annuler (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={`${btnBase} ${btnInactive} disabled:opacity-30`}
          title="Retablir (Ctrl+Y)"
        >
          ↪
        </button>

        <span className="w-px bg-gris/20 mx-1" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))}
          title="Titre H2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive("heading", { level: 3 }))}
          title="Titre H3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={btnClass(editor.isActive("heading", { level: 4 }))}
          title="Titre H4"
        >
          H4
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
          className={btnClass(editor.isActive("heading", { level: 5 }))}
          title="Titre H5"
        >
          H5
        </button>

        <span className="w-px bg-gris/20 mx-1" />

        {/* Inline formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
          title="Gras (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
          title="Italique (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnClass(editor.isActive("underline"))}
          title="Souligne (Ctrl+U)"
        >
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btnClass(editor.isActive("strike"))}
          title="Barre"
        >
          <s>S</s>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={btnClass(editor.isActive("code"))}
          title="Code inline"
        >
          &lt;/&gt;
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={btnClass(editor.isActive("highlight"))}
          title="Surligner"
        >
          <span className="bg-jaune/60 px-0.5">H</span>
        </button>

        <span className="w-px bg-gris/20 mx-1" />

        {/* Lists & blocks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
          title="Liste a puces"
        >
          • Liste
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
          title="Liste numerotee"
        >
          1. Liste
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btnClass(editor.isActive("blockquote"))}
          title="Citation"
        >
          ❝
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={btnClass(editor.isActive("codeBlock"))}
          title="Bloc de code"
        >
          { }
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={`${btnBase} ${btnInactive}`}
          title="Separateur horizontal"
        >
          —
        </button>

        <span className="w-px bg-gris/20 mx-1" />

        {/* Text align */}
        <button
          type="button"
          onClick={() => {
            if (editor.isActive("image")) {
              editor.chain().focus().updateAttributes("image", { "data-align": null }).run();
            } else {
              editor.chain().focus().setTextAlign("left").run();
            }
          }}
          className={btnClass(editor.isActive("image") ? !editor.getAttributes("image")["data-align"] : editor.isActive({ textAlign: "left" }))}
          title="Aligner a gauche"
        >
          ≡←
        </button>
        <button
          type="button"
          onClick={() => {
            if (editor.isActive("image")) {
              editor.chain().focus().updateAttributes("image", { "data-align": "center" }).run();
            } else {
              editor.chain().focus().setTextAlign("center").run();
            }
          }}
          className={btnClass(editor.isActive("image") ? editor.getAttributes("image")["data-align"] === "center" : editor.isActive({ textAlign: "center" }))}
          title="Centrer"
        >
          ≡↔
        </button>
        <button
          type="button"
          onClick={() => {
            if (editor.isActive("image")) {
              editor.chain().focus().updateAttributes("image", { "data-align": "right" }).run();
            } else {
              editor.chain().focus().setTextAlign("right").run();
            }
          }}
          className={btnClass(editor.isActive("image") ? editor.getAttributes("image")["data-align"] === "right" : editor.isActive({ textAlign: "right" }))}
          title="Aligner a droite"
        >
          →≡
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={btnClass(editor.isActive({ textAlign: "justify" }))}
          title="Justifier"
        >
          ≡≡
        </button>

        <span className="w-px bg-gris/20 mx-1" />

        {/* Link & Image */}
        <button
          type="button"
          onClick={handleLinkClick}
          className={btnClass(editor.isActive("link"))}
          title="Lien"
        >
          Lien
        </button>

        {onImageClick && (
          <button
            type="button"
            onClick={onImageClick}
            className={`${btnBase} ${btnInactive}`}
            title="Inserer une image"
          >
            Image
          </button>
        )}
      </div>

      {showLinkInput && (
        <div className="flex items-center gap-2 px-2 pb-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyLink()}
            placeholder="https://..."
            className="flex-1 rounded border border-gris/30 px-2 py-1 text-sm text-noir bg-blanc focus:outline-none focus:ring-1 focus:ring-malachite/50"
            autoFocus
          />
          <button
            type="button"
            onClick={applyLink}
            className="px-3 py-1 text-sm rounded bg-malachite text-blanc hover:bg-malachite/90"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}
            className="px-2 py-1 text-sm text-gris hover:text-noir"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
