import { describe, it, expect } from "vitest";

import { absoluteUrl, jsonLdScript } from "./seo";

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

// #465 — the Person builders emitted /uploads/… straight into `image`, where
// Schema.org wants an absolute URL. The rule already existed for the Event's
// image; it just never followed the speakers.

describe("absoluteUrl", () => {
  // Careful with the origin here: under vitest, `process.env.BASE_URL` is "/" —
  // Vite injects its own BASE_URL (the app's base path) into the environment,
  // so neither the production value nor the localhost fallback applies. A test
  // asserting the prefix would be asserting Vite's default. What is worth
  // pinning is the distinction the function draws, not the origin it uses.
  it("prepends the origin to an uploaded asset", () => {
    const prefixed = absoluteUrl("/uploads/photo.jpg");

    expect(prefixed).not.toBe("/uploads/photo.jpg");
    expect(prefixed.endsWith("/uploads/photo.jpg")).toBe(true);
  });

  it("leaves a third-party photo alone", () => {
    // Speakers imported from 2016-2019 are hosted on twimg, gravatar and the
    // like (#356). Prefixing those would produce a doubled, broken URL.
    const external = "https://pbs.twimg.com/profile_images/42.jpg";
    expect(absoluteUrl(external)).toBe(external);
  });

  it("leaves a plain http host alone too", () => {
    expect(absoluteUrl("http://example.org/a.png")).toBe("http://example.org/a.png");
  });
});
