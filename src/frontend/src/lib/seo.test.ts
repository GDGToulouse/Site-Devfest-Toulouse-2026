import { describe, it, expect } from "vitest";

import { jsonLdScript } from "./seo";

// JSON-LD is injected through dangerouslySetInnerHTML on every page carrying
// structured data. `JSON.stringify` alone leaves `</script>` intact, which ends
// the element early and turns any user-controlled field into stored XSS — and
// `company` is user-controlled: a speaker sets it through their magic link, and
// it is length-capped but never sanitised.

describe("jsonLdScript", () => {
  it("should neutralise a closing script tag", () => {
    const payload = jsonLdScript({ name: "Ada</script><script>alert(1)</script>" });

    expect(payload).not.toMatch(/<\/script/i);
    expect(payload).not.toContain("<script");
  });

  it("should escape every character able to open or close a tag", () => {
    const payload = jsonLdScript({ a: "<", b: ">", c: "&" });

    expect(payload).not.toContain("<");
    expect(payload).not.toContain(">");
    expect(payload).not.toContain("&");
  });

  // The escaping must not change what a consumer reads, or it would corrupt the
  // structured data it exists to serve.
  it("should round-trip to the original object", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Ada</script>",
      worksFor: { "@type": "Organization", name: "R&D <Labs>" },
    };

    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });

  it("should leave ordinary values untouched", () => {
    expect(JSON.parse(jsonLdScript({ name: "Ada Lovelace" }))).toEqual({ name: "Ada Lovelace" });
  });
});
