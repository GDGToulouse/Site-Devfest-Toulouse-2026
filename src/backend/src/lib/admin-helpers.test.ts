import { describe, it, expect } from "vitest";

import {
  pickPartial,
  notDeleted,
  onlyDeleted,
  parkUniqueValue,
  unparkUniqueValue,
  isParkedValue,
  softDeleteData,
  restoreData,
} from "./admin-helpers.js";

describe("pickPartial", () => {
  const existing = { name: "old", count: 5, description: "old desc" };

  it("keeps existing fields when body omits them", () => {
    const out = pickPartial(existing, { name: "new" }, ["name", "count", "description"] as const);
    expect(out).toEqual({ name: "new" });
  });

  it("trims string values", () => {
    const out = pickPartial(existing, { name: "  new  " }, ["name"] as const);
    expect(out.name).toBe("new");
  });

  it("coerces empty strings to null", () => {
    const out = pickPartial(existing, { description: "" }, ["description"] as const);
    expect(out.description).toBeNull();
  });

  it("passes non-string values through", () => {
    const out = pickPartial(existing, { count: 42 }, ["count"] as const);
    expect(out.count).toBe(42);
  });

  it("ignores fields not in the allowlist (no mass assignment)", () => {
    // @ts-expect-error — intentionally passing an extra field
    const out = pickPartial(existing, { name: "x", hacked: true }, ["name"] as const);
    expect(out).toEqual({ name: "x" });
    expect("hacked" in out).toBe(false);
  });
});

describe("soft-delete helpers (#146)", () => {
  it("selects live rows with deletedAt null", () => {
    expect(notDeleted).toEqual({ deletedAt: null });
  });

  it("selects trashed rows with deletedAt not null", () => {
    expect(onlyDeleted).toEqual({ deletedAt: { not: null } });
  });

  it("parks a slug out of the live namespace", () => {
    expect(parkUniqueValue("jane-doe", 42)).toBe("__trash_42__jane-doe");
  });

  it("keeps parked values untouched so a second trash pass cannot nest prefixes", () => {
    const once = parkUniqueValue("jane-doe", 42);
    expect(parkUniqueValue(once, 42)).toBe(once);
  });

  it("gives the original slug back on restore", () => {
    expect(unparkUniqueValue("__trash_42__jane-doe")).toBe("jane-doe");
  });

  it("leaves a never-parked value alone on restore", () => {
    expect(unparkUniqueValue("jane-doe")).toBe("jane-doe");
  });

  it("survives a round trip on slugs that look like the prefix", () => {
    // A real slug could plausibly start with "__trash_" — the id segment is
    // what makes the marker unambiguous.
    const value = "__trash_notes";
    expect(unparkUniqueValue(parkUniqueValue(value, 7))).toBe(value);
  });

  it("round-trips values holding accents and separators", () => {
    const value = "conférence-été-2026";
    expect(unparkUniqueValue(parkUniqueValue(value, 1))).toBe(value);
  });

  it("recognises a parked value", () => {
    expect(isParkedValue("__trash_1__x")).toBe(true);
    expect(isParkedValue("x")).toBe(false);
  });

  it("round-trips with a cuid primary key (User is keyed by string, not Int)", () => {
    const email = "jane@example.com";
    const cuid = "clh3k2j9x0000qwer1234asdf";
    expect(unparkUniqueValue(parkUniqueValue(email, cuid))).toBe(email);
  });

  it("keeps two rows parked under distinct ids distinct", () => {
    // Same email parked twice must not collide, or the unique constraint that
    // parking exists to free would be hit by the parked values themselves.
    const a = parkUniqueValue("jane@example.com", "cuid-a");
    const b = parkUniqueValue("jane@example.com", "cuid-b");
    expect(a).not.toBe(b);
  });

  it("round-trips an email, whose local part may hold dots and plus signs", () => {
    const email = "jane.doe+devfest@example.com";
    expect(unparkUniqueValue(parkUniqueValue(email, 12))).toBe(email);
  });

  it("stamps the deletion date", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    expect(softDeleteData(now)).toEqual({ deletedAt: now });
  });

  it("clears the deletion date on restore", () => {
    expect(restoreData()).toEqual({ deletedAt: null });
  });
});
