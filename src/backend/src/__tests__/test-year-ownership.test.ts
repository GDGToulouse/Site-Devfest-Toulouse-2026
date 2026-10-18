import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// #681 — `Edition.year` is @unique and the test files run in parallel against
// one database. Two files that create an edition for the same year race each
// other: one fails on the unique index (or deletes the other's fixture), and the
// cleanup of the failed one then wipes data it never owned. Each file owns its
// years (#292); this reads every test file and refuses a year shared by two.
//
// The range is the one the fixtures use: before the first real edition (2016),
// after the oldest fixtures. Anything else (1000, 1234, ports, sizes) is noise.

const FIRST_FIXTURE_YEAR = 1500;
const LAST_FIXTURE_YEAR = 2005;

const dir = new URL(".", import.meta.url);

function yearsByFile(): Map<number, string[]> {
  const owners = new Map<number, string[]>();
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".test.ts") && f !== "test-year-ownership.test.ts")) {
    // Comments name years too ("1990 belongs to ..."): only code creates editions.
    const source = readFileSync(new URL(name, dir), "utf8").replace(/\/\/.*$/gm, "");
    const years = new Set([...source.matchAll(/(?<![\d.:#/-])(1[5-9]\d{2}|200[0-5])(?!\d)/g)].map((m) => Number(m[1])));
    for (const year of years) owners.set(year, [...(owners.get(year) ?? []), name]);
  }
  return owners;
}

describe("fixture editions (#681)", () => {
  it("should give every fixture year to a single test file", () => {
    const shared = [...yearsByFile()]
      .filter(([year, files]) => year >= FIRST_FIXTURE_YEAR && year <= LAST_FIXTURE_YEAR && files.length > 1)
      .map(([year, files]) => `${year}: ${files.join(", ")}`);

    expect(shared).toEqual([]);
  });
});
