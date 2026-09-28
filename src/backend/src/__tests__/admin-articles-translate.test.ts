import { describe, it, expect, afterAll, vi } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";

// No Gemini in tests: a deterministic stand-in, the real error classes kept so
// the route still maps failures the way it does in production.
vi.mock("../lib/translation/index.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/translation/index.js")>()),
  isConfigured: () => true,
  translate: async ({ content }: { content: string }) => ({ translatedContent: `[auto] ${content}` }),
}));

const slugPrefix = `test-translate-${Date.now()}`;

afterAll(async () => {
  await prisma.article.deleteMany({ where: { slug: { startsWith: slugPrefix } } });
});

async function createArticle(suffix: string, contentEn: string) {
  const app = await buildAdminApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/articles",
    payload: {
      slug: `${slugPrefix}-${suffix}`,
      titleFr: "Titre d'origine",
      titleEn: "English title",
      contentFr: "<p>Texte d'origine</p>",
      contentEn,
      publicationStatus: "DRAFT",
    },
  });
  await app.close();
  return res.json().id as number;
}

async function translateFrom(id: number, from: "fr" | "en") {
  const app = await buildAdminApp();
  const res = await app.inject({
    method: "POST",
    url: `/api/admin/articles/${id}/translate-fields`,
    payload: { from },
  });
  await app.close();
  return res;
}

describe("POST /api/admin/articles/:id/translate-fields", () => {
  it("should write the target and flag it when the source body has text", async () => {
    const id = await createArticle("filled", "<p>English body</p>");

    const res = await translateFrom(id, "en");

    expect(res.statusCode).toBe(200);
    const stored = await prisma.article.findUniqueOrThrow({ where: { id } });
    expect(stored.contentFr).toContain("[auto]");
    expect(stored.contentFr).toContain("English body");
    expect(stored.autoTranslatedFr).toBe(true);
  });

  it("should refuse an empty source body and leave the target untouched (#488)", async () => {
    const id = await createArticle("empty", "");

    const res = await translateFrom(id, "en");

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "empty_source", message: "Le contenu EN est vide : rien à traduire." });
    const stored = await prisma.article.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({
      titleFr: "Titre d'origine",
      contentFr: "<p>Texte d'origine</p>",
      autoTranslatedFr: false,
    });
  });

  it("should treat an emptied editor paragraph as an empty source (#488)", async () => {
    const id = await createArticle("empty-paragraph", "<p></p>");

    const res = await translateFrom(id, "en");

    expect(res.statusCode).toBe(400);
    const stored = await prisma.article.findUniqueOrThrow({ where: { id } });
    expect(stored.autoTranslatedFr).toBe(false);
  });
});
