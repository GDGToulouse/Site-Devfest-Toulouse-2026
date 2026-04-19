import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";

describe("prompts", () => {
  it("includes target language and format rules", () => {
    const p = buildSystemPrompt("fr", "en", "html");
    expect(p).toContain("French-to-English");
    expect(p).toContain("HTML");
    expect(p).toContain("alt, title, aria-label, placeholder");
  });

  it("renders glossary entries when provided", () => {
    const p = buildSystemPrompt("fr", "en", "plain", { DevFest: "DevFest", AFUP: "AFUP" });
    expect(p).toContain("Glossary");
    expect(p).toContain('"DevFest" -> "DevFest"');
    expect(p).toContain('"AFUP" -> "AFUP"');
  });

  it("falls back to 'none' when glossary is missing/empty", () => {
    expect(buildSystemPrompt("en", "fr", "markdown")).toContain("Glossary: none.");
    expect(buildSystemPrompt("en", "fr", "markdown", {})).toContain("Glossary: none.");
  });

  it("auto source language is described as detected", () => {
    expect(buildSystemPrompt("auto", "en", "html")).toContain("the detected source language");
  });

  it("user prompt wraps content in delimiters", () => {
    const p = buildUserPrompt("Bonjour");
    expect(p).toMatch(/^<content_to_translate>\s*\nBonjour\n<\/content_to_translate>$/);
  });
});
