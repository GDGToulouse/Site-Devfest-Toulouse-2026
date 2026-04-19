import { describe, it, expect } from "vitest";
import { validatePreservation } from "./validator.js";

describe("validator — HTML tag parity", () => {
  it("accepts identical tag structure", () => {
    const a = '<p>Bonjour <strong>monde</strong>.</p>';
    const b = '<p>Hello <strong>world</strong>.</p>';
    expect(validatePreservation(a, b, "html").ok).toBe(true);
  });

  it("rejects when a tag is dropped", () => {
    const a = '<p>Bonjour <strong>monde</strong>.</p>';
    const b = '<p>Hello world.</p>';
    const out = validatePreservation(a, b, "html");
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("tag_mismatch");
  });

  it("rejects when an extra tag is inserted", () => {
    const a = '<p>Hi</p>';
    const b = '<p>Hi</p><p>Extra</p>';
    expect(validatePreservation(a, b, "html").ok).toBe(false);
  });

  it("accepts nested tags with attributes", () => {
    const a = '<a href="https://x.com" title="X">Lien</a><img alt="logo" src="x.png">';
    const b = '<a href="https://x.com" title="X">Link</a><img alt="logo" src="x.png">';
    expect(validatePreservation(a, b, "html").ok).toBe(true);
  });

  it("treats <br> and <br/> as equivalent (same tag name)", () => {
    expect(validatePreservation("Hi<br>there", "Salut<br/>là", "html").ok).toBe(true);
  });
});

describe("validator — placeholders", () => {
  it("accepts identical placeholder counts", () => {
    const a = "Hello {{name}}, you have {count} messages.";
    const b = "Bonjour {{name}}, vous avez {count} messages.";
    expect(validatePreservation(a, b, "plain").ok).toBe(true);
  });

  it("rejects when {{var}} is dropped", () => {
    const a = "Hello {{name}}";
    const b = "Bonjour";
    const out = validatePreservation(a, b, "plain");
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("placeholder_mismatch");
  });

  it("rejects when {var} is duplicated", () => {
    const a = "{count} items";
    const b = "{count} {count} items";
    expect(validatePreservation(a, b, "plain").ok).toBe(false);
  });

  it("handles %s and %d", () => {
    expect(
      validatePreservation("%d items in %s", "%d articles dans %s", "plain").ok,
    ).toBe(true);
    expect(
      validatePreservation("%d items in %s", "items dans %s", "plain").ok,
    ).toBe(false);
  });
});

describe("validator — Markdown structure", () => {
  it("accepts identical link counts", () => {
    const a = "Voir [ici](https://x.com) et [là](https://y.com).";
    const b = "See [here](https://x.com) and [there](https://y.com).";
    expect(validatePreservation(a, b, "markdown").ok).toBe(true);
  });

  it("rejects when a link is dropped", () => {
    const a = "Voir [ici](https://x.com) et [là](https://y.com).";
    const b = "See [here](https://x.com).";
    expect(validatePreservation(a, b, "markdown").ok).toBe(false);
  });

  it("counts code fences", () => {
    const a = "```js\nconst x=1;\n```";
    const b = "```js\nconst x=1;\n```";
    expect(validatePreservation(a, b, "markdown").ok).toBe(true);
  });

  it("rejects when a code fence is dropped", () => {
    const a = "```js\nconst x=1;\n```";
    const b = "const x=1;";
    expect(validatePreservation(a, b, "markdown").ok).toBe(false);
  });
});
