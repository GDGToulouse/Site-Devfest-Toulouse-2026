import { describe, it, expect } from "vitest";
import { availToIsSoldOut } from "./tickets.js";

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
