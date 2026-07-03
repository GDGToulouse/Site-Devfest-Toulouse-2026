import { describe, it, expect } from "vitest";

import { normalizeWordpressHtml } from "./normalize-wordpress-html.js";
import { sanitizeRichHtml } from "../../src/lib/sanitize.js";

function column(fraction: string, inner: string): string {
  return (
    `<div class="fusion-layout-column fusion_builder_column_${fraction} ${fraction.replace("_", "-")}">` +
    `<div class="fusion-column-wrapper"><div class="fusion-text fusion-text-1">${inner}</div></div>` +
    `</div>`
  );
}

function row(columns: string): string {
  return `<div class="fusion-fullwidth"><div class="fusion-builder-row fusion-row">${columns}</div></div>`;
}

describe("normalizeWordpressHtml", () => {
  it("turns four 1/4 columns into a 4-col grid and drops fusion noise", () => {
    const input = row(
      ["1_4", "1_4", "1_4", "1_4"]
        .map((f, i) => column(f, `<p>Person ${i}</p><img src="https://x/p${i}.png">`))
        .join(""),
    );
    const out = normalizeWordpressHtml(input);

    expect(out).toContain("md:grid-cols-4");
    expect(out).not.toMatch(/fusion[-_]/);
    expect(out).not.toContain("style=");
    expect(out.match(/<img/g)).toHaveLength(4);
  });

  it("turns a 3/5 + 2/5 row into a 5-col grid with col-spans", () => {
    const input = row(
      column("3_5", "<h2>Title</h2><p>Text</p>") +
        column("2_5", '<img src="https://x/img.png">'),
    );
    const out = normalizeWordpressHtml(input);

    expect(out).toContain("md:grid-cols-5");
    expect(out).toContain("md:col-span-3");
    expect(out).toContain("md:col-span-2");
  });

  it("unwraps a single full-width column without emitting a grid", () => {
    const out = normalizeWordpressHtml(row(column("1_1", "<p>Just text</p><h2>Heading</h2>")));
    expect(out).toContain("<p>Just text</p>");
    expect(out).toContain("<h2>Heading</h2>");
    expect(out).not.toContain("grid-cols");
  });

  it("converts a Gutenberg wp-block-columns into a grid", () => {
    const input =
      '<div class="wp-block-columns is-layout-flex">' +
      '<div class="wp-block-column"><p>A</p></div>' +
      '<div class="wp-block-column"><p>B</p></div>' +
      "</div>";
    const out = normalizeWordpressHtml(input);

    expect(out).toContain("md:grid-cols-2");
    expect(out).not.toContain("wp-block");
  });

  it("strips leaked markdown hashes from headings", () => {
    expect(normalizeWordpressHtml("<h2>## Montaine</h2>")).toBe("<h2>Montaine</h2>");
  });

  it("drops empty paragraphs and empty headings", () => {
    const out = normalizeWordpressHtml("<p>&nbsp;</p><h2></h2><p>real</p>");
    expect(out).toBe("<p>real</p>");
  });

  it("preserves blockquotes", () => {
    const out = normalizeWordpressHtml("<blockquote><p>A quote</p></blockquote>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("A quote");
  });

  it("maps inline text-align:center to a utility class", () => {
    const out = normalizeWordpressHtml('<p style="text-align: center;">Centered</p>');
    expect(out).toContain("text-center");
    expect(out).not.toContain("style=");
  });

  it("centers classic aligned images", () => {
    const out = normalizeWordpressHtml('<img class="aligncenter wp-image-12 size-large" src="https://x/a.png">');
    expect(out).toContain("mx-auto");
    expect(out).not.toContain("wp-image");
  });

  it("never throws on malformed input", () => {
    expect(() => normalizeWordpressHtml("<div><p>unclosed <img src=")).not.toThrow();
    expect(normalizeWordpressHtml("")).toBe("");
  });

  it("produces output whose layout classes survive the sanitizer", () => {
    const input = row(
      column("3_5", "<h2>Title</h2><p>Text</p>") + column("2_5", '<img src="https://x/img.png">'),
    );
    const sanitized = sanitizeRichHtml(normalizeWordpressHtml(input));
    expect(sanitized).toContain("md:grid-cols-5");
    expect(sanitized).toContain("md:col-span-3");
    expect(sanitized).not.toMatch(/fusion[-_]/);
  });
});
