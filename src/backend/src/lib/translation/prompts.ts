import type { Format, Lang, SourceLang } from "./types.js";

const FORMAT_RULES: Record<Format, string> = {
  html:
    "For HTML: translate ONLY text content between tags and the values of these attributes: alt, title, aria-label, placeholder. " +
    "Never translate tag names, class names, IDs, URLs, or other attribute values. " +
    "Preserve every tag exactly as written, including self-closing tags and attribute order.",
  markdown:
    "For Markdown: translate prose only. Never translate content inside code fences (```) or inline code (`). " +
    "Translate the visible text in [text](url) but keep the URL intact. " +
    "Preserve all syntax markers: #, ##, **, *, `, ```, ---, |, -, >.",
  plain:
    "Plain text: translate the entire content as-is, preserving line breaks and indentation.",
};

const LANG_NAME: Record<Lang, string> = { fr: "French", en: "English" };

export function buildSystemPrompt(
  sourceLang: SourceLang,
  targetLang: Lang,
  format: Format,
  glossary?: Record<string, string>,
): string {
  const sourceName = sourceLang === "auto" ? "the detected source language" : LANG_NAME[sourceLang];
  const targetName = LANG_NAME[targetLang];

  const glossaryBlock = glossary && Object.keys(glossary).length > 0
    ? "Glossary (apply EXACTLY, case-sensitive):\n" +
      Object.entries(glossary).map(([k, v]) => `  - "${k}" -> "${v}"`).join("\n")
    : "Glossary: none.";

  return [
    `You are a professional ${sourceName}-to-${targetName} translator for a web editorial platform.`,
    "",
    "STRICT RULES:",
    `1. ${FORMAT_RULES[format]}`,
    "2. Preserve placeholders verbatim: {{var}}, {var}, %s, %d, ${var}.",
    "3. Preserve all whitespace, line breaks, and indentation.",
    "4. Output ONLY the translated content. No explanations, no notes, no quoting, no preamble.",
    "5. Keep an editorial, neutral tone suitable for a public-facing website.",
    "",
    glossaryBlock,
  ].join("\n");
}

// We wrap the user content in clear delimiters so the model never confuses
// an instruction-looking sentence inside the content with a system order.
export function buildUserPrompt(content: string): string {
  return `<content_to_translate>\n${content}\n</content_to_translate>`;
}
