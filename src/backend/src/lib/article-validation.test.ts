import { describe, it, expect } from "vitest";
import { missingArticleFields } from "./article-validation.js";

// Drafts are permissive, publishing is strict (#263).

const complete = {
  slug: "mon-article",
  titleFr: "Titre",
  titleEn: "Title",
  contentFr: "<p>Contenu</p>",
  contentEn: "<p>Content</p>",
};

describe("missingArticleFields — DRAFT", () => {
  it("only requires slug and titleFr", () => {
    expect(missingArticleFields({ slug: "s", titleFr: "T" }, "DRAFT")).toEqual([]);
  });

  it("reports what is missing, in a stable order", () => {
    expect(missingArticleFields({}, "DRAFT")).toEqual(["slug", "titleFr"]);
  });

  it("never fails on a missing translation or body", () => {
    expect(missingArticleFields({ slug: "s", titleFr: "T", titleEn: "", contentFr: "" }, "DRAFT")).toEqual([]);
  });
});

describe("missingArticleFields — PUBLISHED", () => {
  it("accepts a complete article", () => {
    expect(missingArticleFields(complete, "PUBLISHED")).toEqual([]);
  });

  it("requires both languages", () => {
    expect(missingArticleFields({ ...complete, titleEn: "" }, "PUBLISHED")).toEqual(["titleEn"]);
    expect(missingArticleFields({ ...complete, contentEn: "" }, "PUBLISHED")).toEqual(["contentEn"]);
  });

  it("lists every missing field at once", () => {
    expect(missingArticleFields({ slug: "s", titleFr: "T" }, "PUBLISHED")).toEqual([
      "titleEn",
      "contentFr",
      "contentEn",
    ]);
  });

  it("treats an empty rich-text editor as empty content", () => {
    // Tiptap sends <p></p> for an untouched editor — that is not content.
    expect(missingArticleFields({ ...complete, contentEn: "<p></p>" }, "PUBLISHED")).toEqual(["contentEn"]);
    expect(missingArticleFields({ ...complete, contentFr: "<p>&nbsp;</p>" }, "PUBLISHED")).toEqual(["contentFr"]);
  });

  it("accepts content that only carries markup around real text", () => {
    expect(missingArticleFields({ ...complete, contentEn: "<p><strong>Hi</strong></p>" }, "PUBLISHED")).toEqual([]);
  });

  it("ignores whitespace-only titles", () => {
    expect(missingArticleFields({ ...complete, titleEn: "   " }, "PUBLISHED")).toEqual(["titleEn"]);
  });
});
