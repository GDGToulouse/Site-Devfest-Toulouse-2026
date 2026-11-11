import { describe, it, expect } from "vitest";
import { availToIsSoldOut, shopLink } from "./tickets.js";

const SHOP = "https://www.billetweb.fr/shop.php?event=devfest-toulouse-2026";
const EVENT = "https://www.billetweb.fr/devfest-toulouse-2026";

// The import stores the event's public address with the tracking source:
// Billetweb's API only gives the long shop.php form (#507, #798).
describe("shopLink", () => {
  it("turns the shop URL into the event's short address, with the src parameter", () => {
    expect(shopLink(SHOP, "site")).toBe(`${EVENT}?src=site`);
  });

  it("drops an src parameter Billetweb already put on the shop URL", () => {
    expect(shopLink(`${SHOP}&src=old`, "site")).toBe(`${EVENT}?src=site`);
  });

  it("encodes a source typed with spaces or symbols", () => {
    expect(shopLink(SHOP, " newsletter octobre ")).toBe(`${EVENT}?src=newsletter+octobre`);
  });

  it("gives the bare short address when the source is blank or missing", () => {
    expect(shopLink(SHOP, "  ")).toBe(EVENT);
    expect(shopLink(SHOP, undefined)).toBe(EVENT);
  });

  it("only adds the source to a URL that names no event", () => {
    expect(shopLink(EVENT, "site")).toBe(`${EVENT}?src=site`);
  });

  it("returns null when Billetweb gave no shop URL", () => {
    expect(shopLink(undefined, "site")).toBeNull();
    expect(shopLink("", "site")).toBeNull();
  });

  it("keeps an unparseable URL as Billetweb sent it", () => {
    expect(shopLink("not a url", "site")).toBe("not a url");
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
