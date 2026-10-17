import { describe, it, expect } from "vitest";

import { localPath } from "./local-path";

// Where to land after signing in comes from the address bar: it must stay on
// this site whatever the browser makes of it. `/\host` reads as a path, but a
// browser turns the backslash into a slash and leaves for `//host`.
describe("localPath", () => {
  it.each(["/sponsor", "/sponsor/6?tab=offres", "/sponsor/invitation/abc#top"])("should keep %s", (path) => {
    expect(localPath(path, "/fallback")).toBe(path);
  });

  it.each([
    "/\\evil.example/",
    "//evil.example/",
    "\\\\evil.example",
    "https://evil.example/",
    "javascript:alert(1)",
    "sponsor",
    "",
  ])("should fall back for %s", (raw) => {
    expect(localPath(raw, "/fallback")).toBe("/fallback");
  });
});
