import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STAT_ICON_KEYS, isValidStatIcon } from "./stat-icons.js";

describe("isValidStatIcon", () => {
  it("accepts every catalogue key", () => {
    for (const key of STAT_ICON_KEYS) {
      expect(isValidStatIcon(key)).toBe(true);
    }
  });

  it("accepts an empty icon — a key figure may have none", () => {
    expect(isValidStatIcon("")).toBe(true);
  });

  it("rejects a key the site cannot render", () => {
    // The exact typo that used to render nothing at all, silently.
    expect(isValidStatIcon("user")).toBe(false);
    expect(isValidStatIcon("fa-users")).toBe(false);
    expect(isValidStatIcon("🎉")).toBe(false);
  });
});

// The rendering catalogue lives in the frontend (it carries Font Awesome
// definitions); only the keys are mirrored here. If the two drift, the admin
// could offer an icon the API rejects — or worse, accept one nothing renders.
describe("catalogue parity with the frontend", () => {
  it("mirrors exactly the frontend catalogue keys", () => {
    const source = readFileSync(
      new URL("../../../frontend/src/lib/stat-icons.ts", import.meta.url),
      "utf8",
    );
    const frontendKeys = [...source.matchAll(/\{\s*key:\s*"([^"]+)"/g)].map((m) => m[1]);

    expect(frontendKeys.length).toBeGreaterThan(0);
    expect(frontendKeys).toEqual([...STAT_ICON_KEYS]);
  });
});
