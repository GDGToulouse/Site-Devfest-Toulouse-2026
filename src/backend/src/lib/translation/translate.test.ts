// Lock the API key before importing the lib so the readiness check passes.
process.env.GEMINI_API_KEY = "test-key";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma at the module level: TranslationLog writes are best-effort and
// we don't want a real DB for unit tests of the translation pipeline.
vi.mock("../prisma.js", () => ({
  prisma: {
    translationLog: { create: vi.fn().mockResolvedValue({ id: 1 }) },
  },
}));

// Mock the Gemini network call. Each test installs the response it wants.
vi.mock("./gemini-client.js", async () => {
  const actual = await vi.importActual<typeof import("./gemini-client.js")>("./gemini-client.js");
  return {
    ...actual,
    callGemini: vi.fn(),
    isConfigured: () => true,
  };
});

import { translate } from "./index.js";
import { RateLimiter } from "./rate-limiter.js";
import * as gemini from "./gemini-client.js";

const callGemini = gemini.callGemini as ReturnType<typeof vi.fn>;

describe("translate", () => {
  beforeEach(() => {
    callGemini.mockReset();
  });

  afterEach(() => {
    callGemini.mockReset();
  });

  it("returns the translated content for valid HTML", async () => {
    callGemini.mockResolvedValue({ text: "<p>Hello world</p>", inputTokens: 100, outputTokens: 100 });
    const out = await translate({
      content: "<p>Bonjour monde</p>",
      sourceLang: "fr",
      targetLang: "en",
      format: "html",
    });
    expect(out.translatedContent).toBe("<p>Hello world</p>");
    expect(out.sourceLang).toBe("fr");
    expect(out.targetLang).toBe("en");
    expect(out.tokensUsed.input).toBe(100);
  });

  it("rejects empty content with invalid_input", async () => {
    await expect(
      translate({ content: "  ", sourceLang: "fr", targetLang: "en", format: "html" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects when sourceLang === targetLang", async () => {
    await expect(
      translate({ content: "Hi", sourceLang: "fr", targetLang: "fr", format: "plain" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects content above the size ceiling", async () => {
    const huge = "a".repeat(200_001);
    await expect(
      translate({ content: huge, sourceLang: "fr", targetLang: "en", format: "plain" }),
    ).rejects.toMatchObject({ code: "content_too_large" });
  });

  it("retries once on tag mismatch then surfaces tag_mismatch", async () => {
    // Both attempts return broken HTML (missing the <strong> tag).
    callGemini.mockResolvedValue({ text: "<p>Hello world</p>", inputTokens: 50, outputTokens: 50 });

    await expect(
      translate({
        content: "<p>Bonjour <strong>monde</strong></p>",
        sourceLang: "fr", targetLang: "en", format: "html",
      }),
    ).rejects.toMatchObject({ code: "tag_mismatch" });

    expect(callGemini).toHaveBeenCalledTimes(2);
  });

  it("succeeds when the second attempt fixes the structure", async () => {
    callGemini
      .mockResolvedValueOnce({ text: "<p>Hello world</p>", inputTokens: 50, outputTokens: 50 })
      .mockResolvedValueOnce({ text: "<p>Hello <strong>world</strong></p>", inputTokens: 50, outputTokens: 50 });

    const out = await translate({
      content: "<p>Bonjour <strong>monde</strong></p>",
      sourceLang: "fr", targetLang: "en", format: "html",
    });
    expect(out.translatedContent).toBe("<p>Hello <strong>world</strong></p>");
    expect(callGemini).toHaveBeenCalledTimes(2);
  });

  it("strips wrapping <content_to_translate> tags from model output", async () => {
    callGemini.mockResolvedValue({ text: "<content_to_translate>Hello</content_to_translate>", inputTokens: 10, outputTokens: 10 });
    const out = await translate({
      content: "Bonjour", sourceLang: "fr", targetLang: "en", format: "plain",
    });
    expect(out.translatedContent).toBe("Hello");
  });

  it("strips a leading code fence wrapping the output", async () => {
    callGemini.mockResolvedValue({ text: "```html\n<p>Hello</p>\n```", inputTokens: 10, outputTokens: 10 });
    const out = await translate({
      content: "<p>Bonjour</p>", sourceLang: "fr", targetLang: "en", format: "html",
    });
    expect(out.translatedContent).toBe("<p>Hello</p>");
  });

  it("blocks when the rate limiter is saturated", async () => {
    const exhausted = new RateLimiter({ rpm: 0, rpd: 100, tpm: 1_000_000 });
    await expect(
      translate(
        { content: "Bonjour", sourceLang: "fr", targetLang: "en", format: "plain" },
        { rateLimiter: exhausted },
      ),
    ).rejects.toMatchObject({ code: "quota_exhausted" });
  });

  it("auto-detects source language when sourceLang = 'auto'", async () => {
    callGemini.mockResolvedValue({ text: "Hello world", inputTokens: 20, outputTokens: 20 });
    const out = await translate({
      content: "Bonjour le monde, nous sommes là pour vous.",
      sourceLang: "auto", targetLang: "en", format: "plain",
    });
    expect(out.sourceLang).toBe("fr");
  });
});
