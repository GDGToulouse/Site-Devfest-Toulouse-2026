import { describe, it, expect } from "vitest";

import { sanitizeSvg } from "./svg-sanitize.js";

// #346 — an uploaded SVG is served same-origin from /uploads/ with its native
// content-type, and the CSP allows inline scripts. Anything executable that
// survives this function is a stored XSS, reachable by any sponsor holding a
// magic link. These lock the payloads that motivated #306.

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`;

describe("sanitizeSvg — executable content", () => {
  it("should drop a script element and its payload", () => {
    const out = sanitizeSvg(wrap('<script>alert(1)</script><path d="M0 0h24v24H0z"/>'))!;

    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<path");
  });

  it("should drop event handlers", () => {
    const out = sanitizeSvg(wrap('<path d="M0 0" onload="alert(1)" onclick="alert(2)"/>'))!;

    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toContain("alert");
  });

  it("should drop a javascript: link", () => {
    const out = sanitizeSvg(wrap('<a href="javascript:alert(1)"><path d="M0 0"/></a>'))!;

    expect(out).not.toContain("javascript:");
  });

  it("should drop foreignObject, which can embed arbitrary HTML", () => {
    const out = sanitizeSvg(
      wrap('<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="alert(1)"></body></foreignObject>'),
    )!;

    expect(out).not.toMatch(/foreignObject/i);
    expect(out).not.toMatch(/onerror/i);
  });

  it("should drop a <use> pointing at a remote document", () => {
    const out = sanitizeSvg(wrap('<use xlink:href="https://evil.example/payload.svg#x"/>'))!;

    expect(out).not.toContain("evil.example");
  });

  // `<use>` is the one tag allowed to keep an href, so every non-fragment form
  // it could take is pinned here rather than trusted.
  it.each([
    ['<use href="https://evil.example/x.svg#p"/>', "evil.example"],
    ['<use href="//evil.example/x#p"/>', "evil.example"],
    ['<use href="javascript:alert(1)"/>', "javascript:"],
    ['<use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>', "data:"],
    ['<use xlink:href="https://evil.example/x#p"/>', "evil.example"],
  ])("should strip a non-fragment href on <use>: %s", (markup, forbidden) => {
    const out = sanitizeSvg(wrap(markup)) ?? "";

    expect(out.toLowerCase()).not.toContain(forbidden.toLowerCase());
  });

  // A <style> block can pull remote content and, historically, execute in some
  // engines — it is never needed for a logo.
  it("should drop style blocks", () => {
    const out = sanitizeSvg(wrap('<style>@import url("https://evil.example/x.css");</style><path d="M0 0"/>'))!;

    expect(out).not.toMatch(/<style/i);
    expect(out).not.toContain("evil.example");
  });

  it("should drop animation elements that can set attributes at runtime", () => {
    const out = sanitizeSvg(
      wrap('<set attributeName="href" to="javascript:alert(1)"/><animate attributeName="href" values="javascript:alert(1)"/>'),
    )!;

    expect(out).not.toMatch(/<set/i);
    expect(out).not.toMatch(/<animate/i);
    expect(out).not.toContain("javascript:");
  });

  it("should drop embedded objects and iframes", () => {
    const out = sanitizeSvg(wrap('<iframe src="https://evil.example"></iframe><embed src="x"/><object data="y"></object>'))!;

    for (const tag of ["iframe", "embed", "object"]) {
      expect(out.toLowerCase()).not.toContain(`<${tag}`);
    }
  });

  it("should return null when nothing but a script was supplied", () => {
    expect(sanitizeSvg("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeSvg("not an svg at all")).toBeNull();
  });
});

describe("sanitizeSvg — legitimate logos survive", () => {
  it("should keep shapes, paths and their geometry", () => {
    const source = wrap('<path d="M12 2L2 7l10 5 10-5-10-5z" fill="#109E6E" stroke-width="1.5"/><circle cx="12" cy="12" r="4"/>');
    const out = sanitizeSvg(source)!;

    expect(out).toContain('d="M12 2L2 7l10 5 10-5-10-5z"');
    expect(out).toContain('fill="#109E6E"');
    expect(out).toContain('stroke-width="1.5"');
    expect(out).toContain("<circle");
  });

  // Case matters in SVG: `viewBox` lowercased to `viewbox` breaks scaling.
  it("should preserve the case of camelCase attributes and tags", () => {
    const out = sanitizeSvg(wrap('<linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient>'))!;

    expect(out).toContain("viewBox=");
    expect(out).toContain("<linearGradient");
    expect(out).toContain("stop-color=");
  });

  it("should keep gradients, groups and transforms", () => {
    const out = sanitizeSvg(wrap('<g transform="translate(4 4)"><rect width="8" height="8" fill="url(#g)"/></g>'))!;

    expect(out).toContain('transform="translate(4 4)"');
    expect(out).toContain("<rect");
  });

  it("should keep a same-document <use> reference", () => {
    const out = sanitizeSvg(wrap('<symbol id="icon"><path d="M0 0"/></symbol><use href="#icon"/>'))!;

    expect(out).toContain("<use");
    expect(out).toContain("#icon");
  });

  it("should keep text", () => {
    const out = sanitizeSvg(wrap('<text x="0" y="10" font-size="12">DevFest</text>'))!;

    expect(out).toContain("DevFest");
    expect(out).toContain('font-size="12"');
  });
});
