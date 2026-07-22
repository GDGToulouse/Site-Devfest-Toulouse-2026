import { describe, it, expect } from "vitest";

import { looksLikeHtml, htmlToText } from "./html";

// These feed meta descriptions / OG tags and decide how a description renders.
// A bug here is invisible in the UI but corrupts SEO output — worth locking.

describe("looksLikeHtml", () => {
  it("detects a tagged string", () => {
    expect(looksLikeHtml("<p>Bonjour</p>")).toBe(true);
    expect(looksLikeHtml("texte avec <strong>gras</strong>")).toBe(true);
  });

  it("treats plain text (including newlines) as not HTML", () => {
    // Legacy descriptions are plain text with newlines — they must NOT be taken
    // for HTML, or the page would render them raw instead of as paragraphs.
    expect(looksLikeHtml("Ligne un\nLigne deux")).toBe(false);
    expect(looksLikeHtml("Prix < 10 euros")).toBe(false); // a bare "<" is not a tag
  });
});

describe("htmlToText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(htmlToText("<p>Bonjour</p>\n<p>le monde</p>")).toBe("Bonjour le monde");
  });

  it("trims and does not leave doubled spaces where tags were", () => {
    expect(htmlToText("<h1>Titre</h1>   <p>corps</p>")).toBe("Titre corps");
  });

  it("returns plain text unchanged apart from whitespace", () => {
    expect(htmlToText("  déjà du texte  ")).toBe("déjà du texte");
  });

  it("leaves entities as-is (documented: good enough for meta)", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p>")).toBe("Tom &amp; Jerry");
  });
});
