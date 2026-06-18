import { describe, it, expect } from "vitest";
import {
  normalizeSocial,
  buildSocialLinks,
  normalizeFormat,
  normalizeLevel,
  normalizeLanguage,
  normalizePhotoUrl,
} from "./history-import.js";

describe("normalizeSocial", () => {
  it("maps modern { type, url } shape", () => {
    expect(normalizeSocial({ type: "twitter", url: "https://x" })).toEqual(["twitter", "https://x"]);
  });

  it("maps old { name, link } shape", () => {
    expect(normalizeSocial({ name: "Twitter", link: "https://twitter.com/foo" })).toEqual([
      "twitter",
      "https://twitter.com/foo",
    ]);
  });

  it("falls back to URL host when hint is generic", () => {
    expect(normalizeSocial({ name: "@foo", link: "https://github.com/foo" })).toEqual([
      "github",
      "https://github.com/foo",
    ]);
  });

  it("treats unknown links as website", () => {
    expect(normalizeSocial({ link: "https://blog.example.com" })).toEqual(["website", "https://blog.example.com"]);
  });

  it("returns null when no url/link", () => {
    expect(normalizeSocial({ name: "Twitter" })).toBeNull();
  });
});

describe("buildSocialLinks", () => {
  it("merges mixed shapes, first wins per key", () => {
    const out = buildSocialLinks([
      { type: "twitter", url: "https://x.com/a" },
      { name: "github", link: "https://github.com/a" },
      { type: "twitter", url: "https://x.com/duplicate" },
    ]);
    expect(out).toEqual({ twitter: "https://x.com/a", github: "https://github.com/a" });
  });

  it("handles undefined", () => {
    expect(buildSocialLinks(undefined)).toEqual({});
  });
});

describe("normalizeFormat", () => {
  it("maps known formats", () => {
    expect(normalizeFormat("keynote")).toBe("KEYNOTE");
    expect(normalizeFormat("quickie")).toBe("QUICKIE");
    expect(normalizeFormat("conference")).toBe("CONFERENCE");
  });
  it("defaults to CONFERENCE", () => {
    expect(normalizeFormat(undefined)).toBe("CONFERENCE");
    expect(normalizeFormat("workshop")).toBe("CONFERENCE");
  });
});

describe("normalizeLevel", () => {
  it("maps accented French levels", () => {
    expect(normalizeLevel("débutant")).toBe("DEBUTANT");
    expect(normalizeLevel("intermédiaire")).toBe("INTERMEDIAIRE");
    expect(normalizeLevel("confirmé")).toBe("CONFIRME");
  });
  it("returns null for unknown/missing", () => {
    expect(normalizeLevel(undefined)).toBeNull();
    expect(normalizeLevel("expert")).toBeNull();
  });
});

describe("normalizeLanguage", () => {
  it("returns en only for en, fr otherwise", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("fr")).toBe("fr");
    expect(normalizeLanguage(undefined)).toBe("fr");
  });
});

describe("normalizePhotoUrl", () => {
  it("drops local /images paths (not shipped, would 404)", () => {
    expect(normalizePhotoUrl("/images/speakers/foo.png")).toBeNull();
  });
  it("keeps absolute http(s) URLs", () => {
    expect(normalizePhotoUrl("https://cdn/foo.jpg")).toBe("https://cdn/foo.jpg");
  });
  it("returns null for missing", () => {
    expect(normalizePhotoUrl(undefined)).toBeNull();
  });
});
