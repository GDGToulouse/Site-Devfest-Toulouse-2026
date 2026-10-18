import { describe, it, expect } from "vitest";

import { trustedOriginsFor } from "./trusted-origins.js";

// The origins better-auth trusts for sign-in POSTs and post-login redirects.
// A wildcard on the registered domain trusted every subdomain: the other
// environments, the hosting panel, the old sites hosted elsewhere (#658).
describe("trustedOriginsFor", () => {
  it("should trust production with and without www, and nothing else of the domain", () => {
    const origins = trustedOriginsFor("https://devfesttoulouse.fr", "http://frontend:3000");

    expect(origins).toEqual(["https://devfesttoulouse.fr", "https://www.devfesttoulouse.fr", "http://frontend:3000"]);
  });

  it("should trust a deeper environment's own origin only", () => {
    const origins = trustedOriginsFor("https://beta.site.devfesttoulouse.fr", "http://frontend:3000");

    expect(origins).toEqual(["https://beta.site.devfesttoulouse.fr", "http://frontend:3000"]);
  });

  it("should never hand out a wildcard", () => {
    const origins = trustedOriginsFor("https://www.devfesttoulouse.fr", "http://localhost:3000");

    expect(origins.some((o) => o.includes("*"))).toBe(false);
    expect(origins).toContain("https://devfesttoulouse.fr");
  });
});
