import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  socialKeyFor,
  buildSocialLinks,
  matchEnum,
  categoryRole,
  isLocalUpload,
  loadSessionizeData,
  resolveSpeakerPhoto,
  FORMAT_KEYWORDS,
  LEVEL_KEYWORDS,
  LANGUAGE_KEYWORDS,
  type ImportReport,
} from "./sessionize-import.js";
import { fetchAndStoreImage } from "./image-store.js";

vi.mock("./image-store.js", () => ({ fetchAndStoreImage: vi.fn() }));

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

  it("maps the French 'Avancé' level (#247)", () => {
    expect(matchEnum("Avancé", LEVEL_KEYWORDS)).toBe("CONFIRME");
    expect(matchEnum("Avance", LEVEL_KEYWORDS)).toBe("CONFIRME");
  });

  it("maps the Workshop format (#247)", () => {
    expect(matchEnum("Workshop", FORMAT_KEYWORDS)).toBe("WORKSHOP");
    expect(matchEnum("Atelier", FORMAT_KEYWORDS)).toBe("WORKSHOP");
    // Workshop must win over the generic "conf|talk|session" catch-all.
    expect(matchEnum("Workshop session", FORMAT_KEYWORDS)).toBe("WORKSHOP");
  });

  it("maps language names to an ISO code (#247)", () => {
    expect(matchEnum("Français", LANGUAGE_KEYWORDS)).toBe("fr");
    expect(matchEnum("French", LANGUAGE_KEYWORDS)).toBe("fr");
    expect(matchEnum("English", LANGUAGE_KEYWORDS)).toBe("en");
    expect(matchEnum("Anglais", LANGUAGE_KEYWORDS)).toBe("en");
    expect(matchEnum("Klingon", LANGUAGE_KEYWORDS)).toBeNull();
  });
});

describe("categoryRole", () => {
  it("classifies by type/title", () => {
    expect(categoryRole({ id: 1, title: "Session format", items: [] })).toBe("format");
    expect(categoryRole({ id: 2, title: "Niveau", items: [] })).toBe("level");
    expect(categoryRole({ id: 3, title: "Track", items: [] })).toBe("track");
  });

  it("classifies a language category and no longer treats it as a track (#247)", () => {
    expect(categoryRole({ id: 4, title: "Language", items: [] })).toBe("language");
    expect(categoryRole({ id: 5, title: "Langue", items: [] })).toBe("language");
  });
});

describe("isLocalUpload", () => {
  it("recognizes locally stored images only", () => {
    expect(isLocalUpload("/uploads/123-abc.jpg")).toBe(true);
    expect(isLocalUpload("https://sessionize.com/image/abc.jpg")).toBe(false);
    expect(isLocalUpload(null)).toBe(false);
    expect(isLocalUpload(undefined)).toBe(false);
  });
});

describe("resolveSpeakerPhoto", () => {
  const emptyReport = (): ImportReport => ({
    speakers: { created: 0, updated: 0 },
    talks: { created: 0, updated: 0 },
    categories: { created: 0, reused: 0 },
    links: 0,
    warnings: [],
  });

  beforeEach(() => {
    vi.mocked(fetchAndStoreImage).mockReset();
  });

  it("downloads a remote picture and returns its local URL", async () => {
    vi.mocked(fetchAndStoreImage).mockResolvedValue("/uploads/1-a.jpg");
    const report = emptyReport();

    const url = await resolveSpeakerPhoto("https://sessionize.com/image/a.jpg", null, "Jane", report);

    expect(url).toBe("/uploads/1-a.jpg");
    expect(fetchAndStoreImage).toHaveBeenCalledWith("https://sessionize.com/image/a.jpg");
    expect(report.warnings).toEqual([]);
  });

  it("keeps an existing local photo without re-downloading (idempotence)", async () => {
    const report = emptyReport();

    const url = await resolveSpeakerPhoto(
      "https://sessionize.com/image/a.jpg",
      "/uploads/existing.jpg",
      "Jane",
      report,
    );

    expect(url).toBe("/uploads/existing.jpg");
    expect(fetchAndStoreImage).not.toHaveBeenCalled();
  });

  it("re-downloads when the stored photo is still a remote URL", async () => {
    vi.mocked(fetchAndStoreImage).mockResolvedValue("/uploads/2-b.jpg");
    const report = emptyReport();

    const url = await resolveSpeakerPhoto(
      "https://sessionize.com/image/b.jpg",
      "https://sessionize.com/image/b.jpg",
      "Jane",
      report,
    );

    expect(url).toBe("/uploads/2-b.jpg");
    expect(fetchAndStoreImage).toHaveBeenCalled();
  });

  it("returns null without calling the network when there is no picture", async () => {
    const report = emptyReport();

    expect(await resolveSpeakerPhoto(null, null, "Jane", report)).toBeNull();
    expect(await resolveSpeakerPhoto("   ", null, "Jane", report)).toBeNull();
    expect(fetchAndStoreImage).not.toHaveBeenCalled();
    expect(report.warnings).toEqual([]);
  });

  it("warns and keeps importing when the download fails", async () => {
    vi.mocked(fetchAndStoreImage).mockRejectedValue(new Error("HTTP 404"));
    const report = emptyReport();

    const url = await resolveSpeakerPhoto("https://sessionize.com/image/gone.jpg", null, "Jane", report);

    expect(url).toBeNull();
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain("Jane");
    expect(report.warnings[0]).toContain("HTTP 404");
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
