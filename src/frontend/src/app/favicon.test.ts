import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

// #709 — app/favicon.ico was create-next-app's (the Vercel triangle). Next
// serves it on /favicon.ico and links it from every page of both root layouts,
// so it was the only icon of /admin, /sponsor, /edit and /connect, sat next to
// the configured DevFest icons on the public site, and was the fallback of
// `buildFaviconMetadata` (lib/identity.ts) when no .ico is configured.
const CREATE_NEXT_APP_FAVICON_SHA256 =
  "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932";

const favicon = readFileSync(join(__dirname, "favicon.ico"));

// ICONDIR header (reserved 0, type 1 = icon, count) then one 16-byte entry per
// image, whose first two bytes are width and height (0 meaning 256).
function iconSizes(ico: Buffer): string[] {
  const count = ico.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + i * 16;
    return `${ico[entry] || 256}x${ico[entry + 1] || 256}`;
  });
}

describe("favicon.ico (#709)", () => {
  it("should not be the framework's default icon", () => {
    const sha = createHash("sha256").update(favicon).digest("hex");
    expect(sha).not.toBe(CREATE_NEXT_APP_FAVICON_SHA256);
  });

  it("should be a valid icon file with the sizes browsers ask for", () => {
    expect(favicon.readUInt16LE(0)).toBe(0);
    expect(favicon.readUInt16LE(2)).toBe(1);
    expect(iconSizes(favicon)).toEqual(expect.arrayContaining(["16x16", "32x32"]));
  });
});
