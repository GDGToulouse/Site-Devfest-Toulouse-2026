import { prisma } from "../prisma.js";
import { callGemini, isConfigured } from "./gemini-client.js";
import { QuotaExhaustedError, TranslationError } from "./errors.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { sharedRateLimiter } from "./rate-limiter.js";
import { modelFor, type Lang, type TranslationRequest, type TranslationResponse } from "./types.js";
import { validatePreservation } from "./validator.js";

export { TranslationError, QuotaExhaustedError, sendTranslationError } from "./errors.js";
export { sharedRateLimiter } from "./rate-limiter.js";
export { isConfigured } from "./gemini-client.js";
export type {
  Format, Lang, Quality, SourceLang, TranslationRequest, TranslationResponse,
} from "./types.js";

// 4 chars per token is Gemini's documented English heuristic. French is a
// touch longer but for budgeting it's close enough.
const CHARS_PER_TOKEN = 4;
const MAX_INPUT_CHARS = 200_000;        // hard ceiling, request is rejected above this
const MAX_OUTPUT_TOKENS_FLOOR = 2048;
const MAX_OUTPUT_TOKENS_CEIL = 8192;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function pickMaxOutputTokens(content: string): number {
  const est = estimateTokens(content) * 2;
  return Math.min(MAX_OUTPUT_TOKENS_CEIL, Math.max(MAX_OUTPUT_TOKENS_FLOOR, est));
}

function detectLang(content: string): Lang {
  // Cheap heuristic: presence of common French function words / accented
  // characters tilts toward FR, otherwise EN. Used only when sourceLang =
  // "auto" and only to populate the response metadata + log; the model itself
  // does the real detection from the system prompt.
  const sample = content.slice(0, 2000).toLowerCase();
  const frHints = /(?:\b(?:le|la|les|un|une|des|et|est|pour|avec|dans|sur|par|sont|nous|vous)\b|[éèêàâîïôûùç])/g;
  const enHints = /\b(?:the|and|is|for|with|on|by|are|we|you|of|to|in)\b/g;
  const fr = (sample.match(frHints) ?? []).length;
  const en = (sample.match(enHints) ?? []).length;
  return fr >= en ? "fr" : "en";
}

interface TranslateOpts {
  /** When set, written into TranslationLog.userId for stats. */
  userId?: string | null;
  /** Override the shared rate limiter (used in tests). */
  rateLimiter?: typeof sharedRateLimiter;
}

export async function translate(
  req: TranslationRequest,
  opts: TranslateOpts = {},
): Promise<TranslationResponse> {
  const start = Date.now();
  const limiter = opts.rateLimiter ?? sharedRateLimiter;

  // ----- Input validation -----
  if (!req.content || !req.content.trim()) {
    throw new TranslationError("invalid_input", "content is empty");
  }
  if (req.targetLang !== "fr" && req.targetLang !== "en") {
    throw new TranslationError("invalid_input", "targetLang must be 'fr' or 'en'");
  }
  if (!["fr", "en", "auto"].includes(req.sourceLang)) {
    throw new TranslationError("invalid_input", "sourceLang must be 'fr', 'en', or 'auto'");
  }
  if (req.sourceLang === req.targetLang) {
    throw new TranslationError("invalid_input", "sourceLang and targetLang must differ");
  }
  if (!["html", "markdown", "plain"].includes(req.format)) {
    throw new TranslationError("invalid_input", "format must be 'html', 'markdown', or 'plain'");
  }
  if (req.content.length > MAX_INPUT_CHARS) {
    throw new TranslationError(
      "content_too_large",
      `content exceeds ${MAX_INPUT_CHARS} characters (got ${req.content.length})`,
    );
  }
  if (!isConfigured()) {
    throw new TranslationError("not_configured", "Translation service is not configured");
  }

  const model = modelFor(req.quality);
  const detectedSource: Lang =
    req.sourceLang === "auto" ? detectLang(req.content) : req.sourceLang;

  // ----- Quota gate -----
  const estInput = estimateTokens(req.content);
  const estOutput = estimateTokens(req.content);
  const blocked = limiter.check(estInput + estOutput);
  if (blocked) {
    await logAttempt({
      userId: opts.userId ?? null,
      sourceLang: detectedSource,
      targetLang: req.targetLang,
      format: req.format,
      model,
      inputChars: req.content.length,
      outputChars: 0,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - start,
      status: "quota_exhausted",
      errorCode: blocked.kind,
    });
    throw new QuotaExhaustedError(
      `Translation quota reached (${blocked.kind})`,
      blocked.retryAfterSec,
    );
  }

  // ----- Call Gemini, with one strict retry on validation failure -----
  const systemPrompt = buildSystemPrompt(req.sourceLang, req.targetLang, req.format, req.glossary);
  const userPrompt = buildUserPrompt(req.content);

  let text: string;
  let usage: { input: number; output: number };
  let attempts = 0;

  // First attempt at temperature 0.1 (default).
  while (true) {
    attempts += 1;
    const result = await callGemini({
      model,
      systemInstruction: systemPrompt,
      userContent: userPrompt,
      maxOutputTokens: pickMaxOutputTokens(req.content),
      // Lower temperature on retry to make output more deterministic.
      temperature: attempts === 1 ? 0.1 : 0,
      thinkingBudget: model.includes("flash-lite") ? 0 : undefined,
    });
    text = stripWrapping(result.text);
    usage = { input: result.inputTokens, output: result.outputTokens };

    // Record consumption immediately so concurrent calls see updated quotas
    // even if validation fails.
    limiter.record(usage.input + usage.output);

    const validation = validatePreservation(req.content, text, req.format);
    if (validation.ok) break;

    if (attempts >= 2) {
      await logAttempt({
        userId: opts.userId ?? null,
        sourceLang: detectedSource,
        targetLang: req.targetLang,
        format: req.format,
        model,
        inputChars: req.content.length,
        outputChars: text.length,
        inputTokens: usage.input,
        outputTokens: usage.output,
        durationMs: Date.now() - start,
        status: "validation_error",
        errorCode: validation.reason ?? "tag_mismatch",
      });
      throw new TranslationError(
        validation.reason ?? "tag_mismatch",
        `Translation validation failed: ${validation.issues?.join(", ") ?? "unknown"}`,
      );
    }
    // else: loop once more with stricter temperature.
  }

  await logAttempt({
    userId: opts.userId ?? null,
    sourceLang: detectedSource,
    targetLang: req.targetLang,
    format: req.format,
    model,
    inputChars: req.content.length,
    outputChars: text.length,
    inputTokens: usage.input,
    outputTokens: usage.output,
    durationMs: Date.now() - start,
    status: "success",
    errorCode: null,
  });

  return {
    translatedContent: text,
    sourceLang: detectedSource,
    targetLang: req.targetLang,
    tokensUsed: usage,
    modelUsed: model,
    durationMs: Date.now() - start,
  };
}

// Some Gemini outputs come wrapped in code fences or repeat the
// <content_to_translate> tag in spite of the system prompt. Strip those.
function stripWrapping(text: string): string {
  let out = text.trim();
  // Remove leading/trailing <content_to_translate> tags if present.
  out = out.replace(/^<content_to_translate>\s*/i, "").replace(/\s*<\/content_to_translate>$/i, "");
  // Remove a leading triple-backtick fence (with or without language hint)
  // and the matching trailing fence.
  const fence = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n```$/;
  const m = out.match(fence);
  if (m) out = m[1];
  return out;
}

interface LogEntry {
  userId: string | null;
  sourceLang: string;
  targetLang: string;
  format: string;
  model: string;
  inputChars: number;
  outputChars: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: string;
  errorCode: string | null;
}

async function logAttempt(entry: LogEntry): Promise<void> {
  try {
    await prisma.translationLog.create({ data: entry });
  } catch (err) {
    // Logging is best-effort: never fail the user's request because the
    // analytics table is unavailable.
    // eslint-disable-next-line no-console
    console.warn("[translation] failed to write TranslationLog:", (err as Error).message);
  }
}
