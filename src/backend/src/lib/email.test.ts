import { describe, it, expect } from "vitest";
import { interpolate } from "./email.js";

describe("interpolate", () => {
  it("replaces known tokens", () => {
    const result = interpolate("Hello {firstName} {lastName}", {
      firstName: "John",
      lastName: "Doe",
    });
    expect(result).toBe("Hello John Doe");
  });

  it("leaves unknown tokens as-is", () => {
    expect(interpolate("{unknown} token", {})).toBe("{unknown} token");
  });

  it("handles brochureUrl with HTML link", () => {
    const tpl = 'Consultez la plaquette à <a href="{brochureUrl}">cette adresse</a>.';
    const result = interpolate(tpl, { brochureUrl: "https://example.com/sponsor.pdf" });
    expect(result).toBe('Consultez la plaquette à <a href="https://example.com/sponsor.pdf">cette adresse</a>.');
  });

  it("returns template unchanged when vars is empty", () => {
    expect(interpolate("No tokens here", {})).toBe("No tokens here");
  });

  it("replaces multiple occurrences of the same token", () => {
    expect(interpolate("{name} and {name}", { name: "X" })).toBe("X and X");
  });
});
