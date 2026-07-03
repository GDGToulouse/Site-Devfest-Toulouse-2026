import sharp from "sharp";
import { prisma } from "./prisma.js";
import { callGemini, isConfigured } from "./translation/gemini-client.js";
import { TranslationError, QuotaExhaustedError } from "./translation/errors.js";
import { sharedRateLimiter } from "./translation/rate-limiter.js";

// Alt-text generation reuses the translation infrastructure (Gemini client +
// shared rate limiter + TranslationLog table) so we don't duplicate quota,
// retry, and observability code. The TranslationLog row carries
// `format = "alt_text"` so usage stats can split AI calls by purpose.

// Cheap model — vision is well within reach of flash-lite, and we want this
// to stay free-tier friendly. Override via env if needed.
const MODEL = process.env.GEMINI_ALT_MODEL ?? "gemini-2.5-flash-lite";

// Downscale before sending to Gemini. 768 px keeps enough detail to caption
// a scene while putting the encoded image in the ~50–150 KB range, well under
// the input image budget.
const MAX_IMAGE_WIDTH = 768;
const MAX_OUTPUT_TOKENS = 80;

const SYSTEM_PROMPT = `Tu es un assistant qui rédige des textes alternatifs (attribut HTML \`alt\`) pour des images destinées à des personnes utilisant un lecteur d'écran.

Règles strictes :
- Réponds UNIQUEMENT avec le texte alternatif, sans guillemets, sans préfixe, sans formatage Markdown.
- Écris en français, en une seule phrase courte (5 à 20 mots maximum).
- Décris ce qu'on voit ou la fonction de l'image, sans commencer par « Image », « Photo », « Illustration » (les lecteurs d'écran l'annoncent déjà).
- Sois factuel et concret : éléments visibles, action, ambiance utile à la compréhension.
- N'invente pas d'informations qui ne sont pas visibles (noms propres, dates, lieux non identifiables).
- Si l'image est purement décorative ou illisible, réponds par la chaîne vide.`;

const USER_PROMPT = `Décris cette image en respectant strictement les règles ci-dessus.`;

export interface AltGenerationResult {
  alt: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model: string;
}

export interface AltGenerationOpts {
  /** Logged on TranslationLog.userId for stats. */
  userId?: string | null;
}

/**
 * Generate an `alt` text for an image using Gemini multimodal.
 *
 * - The image is downscaled in memory before being sent to Gemini.
 * - Quota is shared with the translation feature via `sharedRateLimiter`.
 * - Every call (success, error, quota miss) is recorded into TranslationLog
 *   with `format = "alt_text"` for usage tracking.
 */
export async function generateAltText(
  imageBuffer: Buffer,
  mimeType: string,
  opts: AltGenerationOpts = {},
): Promise<AltGenerationResult> {
  const start = Date.now();

  if (!isConfigured()) {
    throw new TranslationError("not_configured", "GEMINI_API_KEY is not set");
  }

  // Prepare image: downscale + re-encode to JPEG (universal, smaller than
  // PNG for photos and accepted by Gemini). Keep PNG for PNG inputs to
  // preserve transparency for logo-like images.
  let prepared: Buffer;
  let preparedMime: string;
  try {
    const pipeline = sharp(imageBuffer, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });

    if (mimeType === "image/png") {
      prepared = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      preparedMime = "image/png";
    } else if (mimeType === "image/webp") {
      prepared = await pipeline.webp({ quality: 80 }).toBuffer();
      preparedMime = "image/webp";
    } else {
      prepared = await pipeline.jpeg({ quality: 80 }).toBuffer();
      preparedMime = "image/jpeg";
    }
  } catch (err) {
    throw new TranslationError(
      "invalid_input",
      `Could not decode image: ${(err as Error).message}`,
    );
  }

  // Quota check — same shared limiter as translation. We estimate input
  // tokens generously: an inline image around 768 px wide costs roughly
  // 1k tokens with the Gemini tokenizer.
  const estimatedTokens = 1200;
  const blocked = sharedRateLimiter.check(estimatedTokens);
  if (blocked) {
    await logAttempt({
      userId: opts.userId ?? null,
      durationMs: Date.now() - start,
      status: "quota_exhausted",
      errorCode: blocked.kind,
      inputChars: 0,
      outputChars: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    throw new QuotaExhaustedError(
      `Alt-text quota reached (${blocked.kind})`,
      blocked.retryAfterSec,
    );
  }

  let result;
  try {
    result = await callGemini({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT,
      userContent: USER_PROMPT,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      thinkingBudget: 0,
      inlineImages: [{ mimeType: preparedMime, base64: prepared.toString("base64") }],
    });
  } catch (err) {
    const code = err instanceof TranslationError ? err.code : "upstream_error";
    await logAttempt({
      userId: opts.userId ?? null,
      durationMs: Date.now() - start,
      status: code === "rate_limit" ? "quota_exhausted" : "upstream_error",
      errorCode: code,
      inputChars: 0,
      outputChars: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    throw err;
  }

  // Always record consumption so concurrent callers see updated quotas even
  // if validation below trims the output to empty.
  sharedRateLimiter.record(result.inputTokens + result.outputTokens);

  const cleaned = cleanAltText(result.text);

  await logAttempt({
    userId: opts.userId ?? null,
    durationMs: Date.now() - start,
    status: "success",
    errorCode: null,
    inputChars: 0,
    outputChars: cleaned.length,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return {
    alt: cleaned,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    durationMs: Date.now() - start,
    model: MODEL,
  };
}

// Strip wrapping quotes / Markdown / leading "Image:" the model occasionally
// adds in spite of the system prompt.
function cleanAltText(raw: string): string {
  let out = raw.trim();
  // Remove a single pair of surrounding quotes (straight, curly, or french).
  out = out.replace(/^["“”«]\s*/, "").replace(/\s*["“”»]$/, "");
  // Remove a leading prefix the model might add ("Alt :", "Texte alternatif :", "Image:", etc.)
  out = out.replace(/^(?:alt|texte\s+alternatif|description|image|photo|illustration)\s*[:\-—]\s*/i, "");
  // Normalize whitespace.
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

interface LogEntry {
  userId: string | null;
  durationMs: number;
  status: string;
  errorCode: string | null;
  inputChars: number;
  outputChars: number;
  inputTokens: number;
  outputTokens: number;
}

async function logAttempt(entry: LogEntry): Promise<void> {
  try {
    await prisma.translationLog.create({
      data: {
        userId: entry.userId,
        sourceLang: "image",
        targetLang: "fr",
        format: "alt_text", // Discriminator from regular translation rows
        model: MODEL,
        inputChars: entry.inputChars,
        outputChars: entry.outputChars,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        durationMs: entry.durationMs,
        status: entry.status,
        errorCode: entry.errorCode,
      },
    });
  } catch (err) {
    // Logging is best-effort: never fail the user's request because the
    // analytics table is unavailable.
    // eslint-disable-next-line no-console
    console.warn("[alt-text] failed to write TranslationLog:", (err as Error).message);
  }
}
