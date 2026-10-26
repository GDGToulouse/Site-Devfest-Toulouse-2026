import { describe, it, expect } from "vitest";
import { availToIsSoldOut, planTierImport, withTrackingSource, type ImportedTier } from "./tickets.js";

const NOW = new Date("2026-11-01T10:00:00Z");

function imported(billetwebTicketId: string, name: string): ImportedTier {
  return {
    billetwebTicketId,
    name,
    price: 50,
    isVisible: true,
    saleStartDate: null,
    saleEndDate: null,
    isSoldOut: false,
  };
}

function existing(id: number, nameFr: string, billetwebTicketId: string | null, sortOrder: number, extra = {}) {
  return { id, nameFr, nameEn: nameFr, billetwebTicketId, sortOrder, deletedAt: null, ...extra };
}

describe("planTierImport (#637)", () => {
  it("updates the tier with the same Billetweb id instead of creating one", () => {
    const plan = planTierImport([existing(7, "Early", "t1", 0)], [imported("t1", "Early bird")], null, NOW);
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([
      { id: 7, data: expect.objectContaining({ nameFr: "Early bird", billetwebTicketId: "t1", sortOrder: 0 }) },
    ]);
  });

  it("never writes the site's own settings", () => {
    const plan = planTierImport([existing(7, "Early", "t1", 0)], [imported("t1", "Early")], null, NOW);
    expect(plan.updates[0].data).not.toHaveProperty("isOutsideFlow");
    expect(plan.updates[0].data).not.toHaveProperty("manualStatus");
  });

  it("attaches a tier imported before ids were kept, by its French name", () => {
    const plan = planTierImport([existing(7, "Early", null, 0)], [imported("t1", "Early")], null, NOW);
    expect(plan.creates).toEqual([]);
    expect(plan.updates[0]).toMatchObject({ id: 7, data: { billetwebTicketId: "t1" } });
  });

  it("creates the tiers Billetweb adds", () => {
    const plan = planTierImport([], [imported("t1", "Early")], "https://shop", NOW);
    expect(plan.creates).toEqual([
      expect.objectContaining({ nameFr: "Early", nameEn: "Early", billetwebTicketId: "t1", externalUrl: "https://shop", sortOrder: 0 }),
    ]);
  });

  it("sends a tier Billetweb no longer returns to the trash", () => {
    const plan = planTierImport([existing(7, "Early", "t1", 0)], [], null, NOW);
    expect(plan.updates).toEqual([{ id: 7, data: { sortOrder: 0, deletedAt: NOW } }]);
  });

  it("keeps a tier created by hand, after the imported ones", () => {
    const plan = planTierImport(
      [existing(3, "Invitation", null, 0), existing(7, "Early", "t1", 1)],
      [imported("t1", "Early")],
      null,
      NOW,
    );
    expect(plan.updates).toEqual([
      { id: 7, data: expect.objectContaining({ sortOrder: 0 }) },
      { id: 3, data: { sortOrder: 1 } },
    ]);
  });

  it("follows Billetweb's order when it reorders the tiers", () => {
    const plan = planTierImport(
      [existing(7, "Early", "t1", 0), existing(8, "Normal", "t2", 1)],
      [imported("t2", "Normal"), imported("t1", "Early")],
      null,
      NOW,
    );
    expect(plan.updates.map((u) => [u.id, u.data.sortOrder])).toEqual([[8, 0], [7, 1]]);
  });

  it("keeps a translated English name, and follows Billetweb's while untranslated", () => {
    const plan = planTierImport(
      [existing(7, "Plein", "t1", 0, { nameEn: "Full price" }), existing(8, "Étudiant", "t2", 1)],
      [imported("t1", "Plein tarif"), imported("t2", "Tarif étudiant")],
      null,
      NOW,
    );
    expect(plan.updates[0].data).not.toHaveProperty("nameEn");
    expect(plan.updates[1].data).toMatchObject({ nameEn: "Tarif étudiant" });
  });
});

const SHOP = "https://www.billetweb.fr/shop.php?event=devfest-toulouse-2026";

describe("withTrackingSource (#507)", () => {
  it("adds the src parameter to the Billetweb shop URL", () => {
    expect(withTrackingSource(SHOP, "site")).toBe(`${SHOP}&src=site`);
  });

  it("replaces an src parameter already present", () => {
    expect(withTrackingSource(`${SHOP}&src=old`, "site")).toBe(`${SHOP}&src=site`);
  });

  it("encodes a source typed with spaces or symbols", () => {
    expect(withTrackingSource(SHOP, " newsletter octobre ")).toBe(`${SHOP}&src=newsletter+octobre`);
  });

  it("keeps the URL untouched when the source is blank or missing", () => {
    expect(withTrackingSource(SHOP, "  ")).toBe(SHOP);
    expect(withTrackingSource(SHOP, undefined)).toBe(SHOP);
  });

  it("returns null when Billetweb gave no shop URL", () => {
    expect(withTrackingSource(undefined, "site")).toBeNull();
    expect(withTrackingSource("", "site")).toBeNull();
  });

  it("keeps an unparseable URL as Billetweb sent it", () => {
    expect(withTrackingSource("not a url", "site")).toBe("not a url");
  });
});

describe("availToIsSoldOut", () => {
  it("treats -1 (unlimited) as not sold out", () => {
    expect(availToIsSoldOut("-1")).toBe(false);
  });

  it("treats a positive remaining quantity as not sold out", () => {
    expect(availToIsSoldOut("5")).toBe(false);
  });

  it("treats 0 remaining as sold out", () => {
    expect(availToIsSoldOut("0")).toBe(true);
  });

  it("treats a negative-but-not-unlimited value as unlimited (not sold out)", () => {
    // Any negative value is BilletWeb's "no limit" sentinel.
    expect(availToIsSoldOut("-4")).toBe(false);
  });

  it("returns null (unknown) for empty, null, undefined or unparseable input", () => {
    expect(availToIsSoldOut("")).toBeNull();
    expect(availToIsSoldOut(null)).toBeNull();
    expect(availToIsSoldOut(undefined)).toBeNull();
    expect(availToIsSoldOut("abc")).toBeNull();
  });
});
