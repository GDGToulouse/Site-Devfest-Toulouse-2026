import { describe, it, expect } from "vitest";
import { parseEmailList } from "./arrivals-access.js";

describe("parseEmailList (#640)", () => {
  it("should read one address per line, comma or semicolon, normalized", () => {
    expect(parseEmailList("Lea@Example.org\nmax@example.org, zoe@example.org;tom@example.org").emails).toEqual([
      "lea@example.org",
      "max@example.org",
      "zoe@example.org",
      "tom@example.org",
    ]);
  });

  it("should keep the address of a 'Name <address>' entry", () => {
    expect(parseEmailList("Jean Dupont <jean.dupont@example.org>").emails).toEqual(["jean.dupont@example.org"]);
  });

  it("should report an entry without an address instead of dropping it", () => {
    expect(parseEmailList("jean.dupont-example.org\nlea@example.org")).toEqual({
      emails: ["lea@example.org"],
      invalid: ["jean.dupont-example.org"],
      duplicates: [],
    });
  });

  it("should report a malformed address and a repeat without refusing the rest", () => {
    expect(parseEmailList("lea@example\nmax@example.org\nMAX@example.org")).toEqual({
      emails: ["max@example.org"],
      invalid: ["lea@example"],
      duplicates: ["max@example.org"],
    });
  });

  it("should ignore blank lines and trailing separators", () => {
    expect(parseEmailList("\n\nlea@example.org,\n;\n").emails).toEqual(["lea@example.org"]);
  });
});
