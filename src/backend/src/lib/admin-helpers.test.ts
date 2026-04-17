import { describe, it, expect } from "vitest";
import { pickPartial } from "./admin-helpers.js";

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
