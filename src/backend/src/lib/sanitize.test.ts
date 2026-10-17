import { describe, it, expect } from "vitest";
import { sanitizeRichHtml, isSafeUrl, unsafeUrlRefusal } from "./sanitize.js";

describe("isSafeUrl", () => {
  it("should accept http and https URLs", () => {
    expect(isSafeUrl("https://example.com/logo.png")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("should accept a site-relative path (our own uploads)", () => {
    expect(isSafeUrl("/uploads/1784015461017-682e094d.png")).toBe(true);
  });

  // The whole point of the allowlist (#223): these end up in a public href.
  it("should reject a javascript: URL", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JavaScript:alert(1)")).toBe(false);
  });

  it("should reject data: and other executable schemes", () => {
    expect(isSafeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
  });

  it("should reject a protocol-relative URL (it bypasses the scheme check)", () => {
    expect(isSafeUrl("//evil.example.com/x.png")).toBe(false);
  });

  // A browser turns the backslash into a slash: `/\host` leaves for `//host`.
  it("should reject a path holding a backslash", () => {
    expect(isSafeUrl("/\\evil.example")).toBe(false);
    expect(isSafeUrl("/uploads\\x.png")).toBe(false);
  });

  it("should reject a schemeless value rather than coercing it", () => {
    expect(isSafeUrl("www.example.com")).toBe(false);
  });

  it("should reject empty or blank input", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("   ")).toBe(false);
  });
});

describe("sanitizeRichHtml", () => {
  // #490 — a partner logo leads to the partner's site: the editor saves a
  // linked image as a link around the image, which must survive storage.
  it("should keep a link around an image", () => {
    const html = '<a href="https://emmaus.example" target="_blank" rel="noopener noreferrer"><img src="/uploads/logo.png" alt="Emmaüs"></a>';

    expect(sanitizeRichHtml(html)).toBe(
      '<a href="https://emmaus.example" target="_blank" rel="noopener noreferrer"><img src="/uploads/logo.png" alt="Emmaüs" /></a>',
    );
  });

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

// The site's utility CSS is all there for whoever writes rich text: a class is
// enough to lay a full-screen block over a public page (#658). Only the
// layout classes of the WordPress import survive.
describe("sanitizeRichHtml — classes", () => {
  it("should drop a class outside the import's list", () => {
    const html = sanitizeRichHtml('<div class="fixed inset-0 z-[60] bg-blanc"><p class="text-3xl">x</p></div>');
    expect(html).not.toContain("class=");
    expect(html).toContain("<p>x</p>");
  });

  it("should keep the import's layout classes and drop the rest of the attribute", () => {
    const html = sanitizeRichHtml('<div class="grid md:grid-cols-2 fixed"><p>x</p></div>');
    expect(html).toContain('class="grid md:grid-cols-2"');
  });
});

describe("unsafeUrlRefusal", () => {
  it("should name the refused field and say what a link may be", () => {
    const refusal = unsafeUrlRefusal({ photoUrl: "javascript:alert(1)" }, ["photoUrl"]);

    expect(refusal).toMatchObject({ error: "unsafe_url", field: "photoUrl" });
    expect(refusal?.message).toContain("chemins du site");
  });

  it("should return nothing when every link passes", () => {
    expect(unsafeUrlRefusal({ photoUrl: "/uploads/a.png", socialLinks: { github: "https://github.com/x" } }, ["photoUrl"])).toBeNull();
  });
});
