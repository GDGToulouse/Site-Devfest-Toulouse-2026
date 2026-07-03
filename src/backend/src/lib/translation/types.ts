export type Lang = "fr" | "en";
export type SourceLang = Lang | "auto";
export type Format = "html" | "markdown" | "plain";
export type Quality = "fast" | "high";

export interface TranslationRequest {
  content: string;
  sourceLang: SourceLang;
  targetLang: Lang;
  format: Format;
  glossary?: Record<string, string>;
  quality?: Quality;
}

export interface TranslationResponse {
  translatedContent: string;
  sourceLang: Lang;
  targetLang: Lang;
  tokensUsed: { input: number; output: number };
  modelUsed: string;
  durationMs: number;
}

// Gemini models. Flash-Lite = best quota/quality ratio; Flash = quality boost.
export const MODEL_FAST = "gemini-2.5-flash-lite";
export const MODEL_HIGH = "gemini-2.5-flash";

export function modelFor(quality: Quality | undefined): string {
  return quality === "high" ? MODEL_HIGH : MODEL_FAST;
}
