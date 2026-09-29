import { describe, it, expect } from "vitest";

import { looksLikeHtml, htmlToText, markLinksSponsored } from "./html";

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

// Partner links must be qualified for Google (#495). The input is what
// sanitizeRichHtml stores: every anchor already carries rel="noopener noreferrer".
describe("markLinksSponsored", () => {
  it("should mark a sanitized https link as sponsored", () => {
    const input =
      '<p>Voir <a target="_blank" rel="noopener noreferrer" href="https://devitjobs.fr">DevITJobs.fr</a> !</p>';
    expect(markLinksSponsored(input)).toBe(
      '<p>Voir <a target="_blank" rel="sponsored noopener noreferrer" href="https://devitjobs.fr">DevITJobs.fr</a> !</p>',
    );
  });

  it("should mark an http link as sponsored", () => {
    expect(markLinksSponsored('<a href="http://DevITJobs.fr" rel="noopener noreferrer">x</a>')).toBe(
      '<a href="http://DevITJobs.fr" rel="sponsored noopener noreferrer">x</a>',
    );
  });

  it("should mark a protocol-relative link as sponsored", () => {
    // sanitizeRichHtml keeps //host links as is: its normalizer reads the
    // leading slash as a site path.
    expect(markLinksSponsored('<a href="//www.partner.com/jobs" rel="noopener noreferrer">x</a>')).toBe(
      '<a href="//www.partner.com/jobs" rel="sponsored noopener noreferrer">x</a>',
    );
  });

  it("should add the rel to an external link that has none", () => {
    expect(markLinksSponsored('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" rel="sponsored noopener noreferrer">x</a>',
    );
  });

  it("should leave links inside the site untouched", () => {
    const input =
      '<a href="/fr/programme" rel="noopener noreferrer">a</a><a href="#top" rel="noopener noreferrer">b</a>';
    expect(markLinksSponsored(input)).toBe(input);
  });

  it("should leave mailto and tel links untouched", () => {
    const input =
      '<a href="mailto:hello@example.com" rel="noopener noreferrer">a</a><a href="tel:+33500000000" rel="noopener noreferrer">b</a>';
    expect(markLinksSponsored(input)).toBe(input);
  });

  it("should leave plain text and an empty string unchanged", () => {
    expect(markLinksSponsored("Rendez-vous sur https://example.com")).toBe(
      "Rendez-vous sur https://example.com",
    );
    expect(markLinksSponsored("")).toBe("");
  });

  it("should not duplicate sponsored when run twice", () => {
    const once = markLinksSponsored('<a href="https://example.com" rel="noopener noreferrer">x</a>');
    expect(markLinksSponsored(once)).toBe(once);
  });
});
