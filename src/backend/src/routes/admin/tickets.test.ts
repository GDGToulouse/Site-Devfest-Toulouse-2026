import { describe, it, expect } from "vitest";
import { availToIsSoldOut, withTrackingSource } from "./tickets.js";

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
