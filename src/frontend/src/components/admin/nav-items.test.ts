import { describe, it, expect } from "vitest";

import { isAdminPathAllowed } from "./nav-items";

// isAdminPathAllowed decides whether AdminShell renders a page or the
// "forbidden" section, so it must mirror the API's role split.

describe("isAdminPathAllowed", () => {
  it("should keep an EDITOR off the sponsoring offers, whose writes are ADMIN-only (#521)", () => {
    expect(isAdminPathAllowed("/admin/sponsor-tiers", "EDITOR")).toBe(false);
    expect(isAdminPathAllowed("/admin/sponsor-tiers/3", "EDITOR")).toBe(false);
  });

  it("should still let an EDITOR open the sponsors, which read the offers catalogue", () => {
    expect(isAdminPathAllowed("/admin/sponsors/3", "EDITOR")).toBe(true);
  });

  it("should let an EDITOR manage sponsors' job offers, like any other record (#609)", () => {
    expect(isAdminPathAllowed("/admin/job-offers", "EDITOR")).toBe(true);
  });

  it("should keep an EDITOR off the arrivals, whose attendees are ADMIN-only (#638)", () => {
    expect(isAdminPathAllowed("/admin/arrivals", "EDITOR")).toBe(false);
  });

  it("should let an ADMIN manage the sponsoring offers", () => {
    expect(isAdminPathAllowed("/admin/sponsor-tiers", "ADMIN")).toBe(true);
  });
});
