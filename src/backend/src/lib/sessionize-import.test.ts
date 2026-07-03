import { describe, it, expect } from "vitest";
import {
  socialKeyFor,
  buildSocialLinks,
  matchEnum,
  categoryRole,
  loadSessionizeData,
  FORMAT_KEYWORDS,
  LEVEL_KEYWORDS,
} from "./sessionize-import.js";

describe("socialKeyFor", () => {
  it("maps by linkType", () => {
    expect(socialKeyFor({ url: "https://t.co/x", linkType: "Twitter" })).toBe("twitter");
    expect(socialKeyFor({ url: "https://x", linkType: "LinkedIn" })).toBe("linkedin");
    expect(socialKeyFor({ url: "https://x", linkType: "GitHub" })).toBe("github");
  });

  it("falls back to URL host when linkType is absent", () => {
    expect(socialKeyFor({ url: "https://github.com/jane" })).toBe("github");
    expect(socialKeyFor({ url: "https://www.linkedin.com/in/jane" })).toBe("linkedin");
    expect(socialKeyFor({ url: "https://x.com/jane" })).toBe("twitter");
    expect(socialKeyFor({ url: "https://bsky.app/profile/jane" })).toBe("bluesky");
  });

  it("returns null for unknown links", () => {
    expect(socialKeyFor({ url: "https://example.com/blog" })).toBeNull();
  });
});

describe("buildSocialLinks", () => {
  it("collects distinct social links and counts them", () => {
    const { social, count } = buildSocialLinks([
      { url: "https://github.com/jane", linkType: "GitHub" },
      { url: "https://x.com/jane", linkType: "Twitter" },
    ]);
    expect(social).toEqual({ github: "https://github.com/jane", twitter: "https://x.com/jane" });
    expect(count).toBe(2);
  });

  it("uses the first generic link as website fallback", () => {
    const { social } = buildSocialLinks([{ url: "https://janedoe.dev" }]);
    expect(social.website).toBe("https://janedoe.dev");
  });

  it("does not overwrite an explicit website", () => {
    const { social } = buildSocialLinks([
      { url: "https://janedoe.dev", linkType: "Company_Website" },
      { url: "https://other.dev" },
    ]);
    expect(social.website).toBe("https://janedoe.dev");
  });

  it("handles undefined links", () => {
    expect(buildSocialLinks(undefined)).toEqual({ social: {}, count: 0 });
  });
});

describe("matchEnum (format/level)", () => {
  it("maps Sessionize format names to our enum", () => {
    expect(matchEnum("Keynote", FORMAT_KEYWORDS)).toBe("KEYNOTE");
    expect(matchEnum("Tool in action", FORMAT_KEYWORDS)).toBe("QUICKIE");
    expect(matchEnum("Conférence", FORMAT_KEYWORDS)).toBe("CONFERENCE");
    expect(matchEnum("Unknown thing", FORMAT_KEYWORDS)).toBeNull();
  });

  it("maps level names to our enum", () => {
    expect(matchEnum("Beginner", LEVEL_KEYWORDS)).toBe("DEBUTANT");
    expect(matchEnum("Intermédiaire", LEVEL_KEYWORDS)).toBe("INTERMEDIAIRE");
    expect(matchEnum("Advanced", LEVEL_KEYWORDS)).toBe("CONFIRME");
  });
});

describe("categoryRole", () => {
  it("classifies by type/title", () => {
    expect(categoryRole({ id: 1, title: "Session format", items: [] })).toBe("format");
    expect(categoryRole({ id: 2, title: "Niveau", items: [] })).toBe("level");
    expect(categoryRole({ id: 3, title: "Track", items: [] })).toBe("track");
  });
});

describe("loadSessionizeData", () => {
  it("parses pasted JSON", async () => {
    const data = await loadSessionizeData({ json: '{"speakers":[],"sessions":[]}' });
    expect(data.speakers).toEqual([]);
  });

  it("rejects payloads with no speakers/sessions arrays", async () => {
    await expect(loadSessionizeData({ json: '{"foo":1}' })).rejects.toThrow();
  });

  it("rejects when neither json nor url is given", async () => {
    await expect(loadSessionizeData({})).rejects.toThrow();
  });
});
