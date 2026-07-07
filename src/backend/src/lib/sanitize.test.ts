import { describe, it, expect } from "vitest";
import { sanitizeRichHtml } from "./sanitize.js";

describe("sanitizeRichHtml", () => {
  it("keeps allowed formatting", () => {
    const input = "<p>Hello <strong>world</strong></p><h2>Title</h2><ul><li>one</li></ul>";
    expect(sanitizeRichHtml(input)).toBe(input);
  });

  it("strips <script> tags entirely", () => {
    expect(sanitizeRichHtml("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
  });

  it("strips inline event handlers", () => {
    expect(sanitizeRichHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x" />');
  });

  it("rejects javascript: and data: URLs on href/src", () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a rel="noopener noreferrer">x</a>');
    expect(sanitizeRichHtml('<img src="data:text/html,<script>">')).toBe('<img />');
  });

  it("adds rel=noopener on anchors", () => {
    const output = sanitizeRichHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(output).toContain('rel="noopener noreferrer"');
  });

  it("strips style/iframe/form", () => {
    expect(sanitizeRichHtml('<style>body{}</style><p>ok</p>')).toBe("<p>ok</p>");
    expect(sanitizeRichHtml('<iframe src="https://evil"></iframe><p>ok</p>')).toBe("<p>ok</p>");
    expect(sanitizeRichHtml('<form><input /></form><p>ok</p>')).toBe("<p>ok</p>");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(sanitizeRichHtml(null)).toBe("");
    expect(sanitizeRichHtml(undefined)).toBe("");
    expect(sanitizeRichHtml("")).toBe("");
  });

  // Schemeless links (e.g. from imported WordPress content or hand-typed
  // domains) must be prefixed with https:// so they don't render as broken
  // relative links (#167).
  it("prefixes https:// on a schemeless href", () => {
    expect(sanitizeRichHtml('<a href="www.devfest.fr">x</a>')).toContain(
      'href="https://www.devfest.fr"',
    );
  });

  it("keeps absolute http(s) hrefs untouched", () => {
    const output = sanitizeRichHtml('<a href="https://example.com">x</a>');
    expect(output).toContain('href="https://example.com"');
    expect(output).not.toContain("https://https://");
  });

  it("does not touch mailto:, tel:, anchors or root-relative hrefs", () => {
    expect(sanitizeRichHtml('<a href="mailto:a@b.fr">m</a>')).toContain('href="mailto:a@b.fr"');
    expect(sanitizeRichHtml('<a href="tel:+33600000000">t</a>')).toContain(
      'href="tel:+33600000000"',
    );
    expect(sanitizeRichHtml('<a href="#section">a</a>')).toContain('href="#section"');
    expect(sanitizeRichHtml('<a href="/fr/actualites">a</a>')).toContain('href="/fr/actualites"');
  });
});
