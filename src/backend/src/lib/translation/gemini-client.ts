import { TranslationError } from "./errors.js";

// Direct REST call to the Gemini generativelanguage API. We don't pull
// @google/genai because the request shape is small and stable, and adding
// a 1 MB SDK for one POST is overkill on a single-instance backend.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiCallParams {
  model: string;
  systemInstruction: string;
  userContent: string;
  maxOutputTokens: number;
  temperature?: number;
  topP?: number;
  // Flash-Lite: pass 0 to disable the reasoning pass (faster, cheaper).
  thinkingBudget?: number;
  // Optional inline image attachments for multimodal prompts (e.g. alt-text
  // generation). Each part embeds the raw image bytes as base64 alongside
  // its mime type. Kept under a few hundred KB total to stay well below the
  // model's image input limits.
  inlineImages?: Array<{ mimeType: string; base64: string }>;
}

export interface GeminiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

function getApiKey(): string {
  // Read at call time so tests can set the env var after import.
  return process.env.GEMINI_API_KEY ?? "";
}

export function isConfigured(): boolean {
  return getApiKey().length > 0;
}

interface GeminiPart { text: string }
interface GeminiInlineDataPart { inlineData: { mimeType: string; data: string } }
type GeminiRequestPart = { text: string } | GeminiInlineDataPart;
interface GeminiContent { parts: GeminiPart[] }
interface GeminiCandidate { content?: GeminiContent }
interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
  promptFeedback?: { blockReason?: string };
}

// Single attempt — retries are handled by the caller (translate.ts) so we can
// log each retry, count it in the rate limiter, and bail out cleanly on
// non-retryable errors.
export async function callGemini(params: GeminiCallParams): Promise<GeminiCallResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new TranslationError("not_configured", "GEMINI_API_KEY is not set");
  }

  const userParts: GeminiRequestPart[] = [{ text: params.userContent }];
  if (params.inlineImages) {
    for (const img of params.inlineImages) {
      userParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }

  const body = {
    contents: [{ role: "user", parts: userParts }],
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    generationConfig: {
      temperature: params.temperature ?? 0.1,
      topP: params.topP ?? 0.95,
      maxOutputTokens: params.maxOutputTokens,
      responseMimeType: "text/plain",
      ...(params.thinkingBudget !== undefined
        ? { thinkingConfig: { thinkingBudget: params.thinkingBudget } }
        : {}),
    },
  };

  const url = `${ENDPOINT}/${params.model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new TranslationError("upstream_error", `Network error calling Gemini: ${(err as Error).message}`);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 30;
    throw new TranslationError("rate_limit", "Gemini rate limit hit (429)", retryAfter);
  }

  if (res.status === 503 || res.status === 502 || res.status === 504) {
    throw new TranslationError("upstream_error", `Gemini transient error ${res.status}`);
  }

  if (!res.ok) {
    // Read body for diagnostics but don't log the raw API key.
    const text = await res.text().catch(() => "");
    throw new TranslationError(
      "upstream_error",
      `Gemini ${res.status}: ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as GeminiResponse;

  // Safety filters can block the request entirely.
  if (json.promptFeedback?.blockReason) {
    throw new TranslationError("upstream_error", `Gemini blocked: ${json.promptFeedback.blockReason}`);
  }

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  if (!text) {
    throw new TranslationError("upstream_error", "Gemini returned empty content");
  }

  return {
    text,
    inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
