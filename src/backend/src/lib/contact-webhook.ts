import { prisma } from "./prisma.js";
import { validateWebhookUrl } from "./webhook-url.js";

// Common shape of the JSON sent to the configured webhook URL.
// Mirrors what the form already POSTed before this refactor — keep
// stable, consumers (n8n, Zapier, Make…) parse these field names.
export interface ContactWebhookPayload {
  id: number;
  submittedAt: string;
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    categoryId: number | null;
    categorySlug: string | null;
    categoryLabel: string | null;
    message: string;
    locale: string | null;
  };
}

const TIMEOUT_MS = 10_000;
const ERROR_MAX_LEN = 500;

function truncateError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.length > ERROR_MAX_LEN ? `${text.slice(0, ERROR_MAX_LEN)}…` : text;
}

async function recordOutcome(
  messageId: number,
  status: "success" | "failed" | "skipped",
  error: string | null,
): Promise<void> {
  try {
    await prisma.contactMessage.update({
      where: { id: messageId },
      data: {
        webhookStatus: status,
        webhookAttemptedAt: new Date(),
        webhookError: error,
      },
    });
  } catch {
    // The bookkeeping update failing shouldn't bubble — the original
    // request has already returned to the caller by now.
  }
}

interface SendOptions {
  /** Override the URL stored in SiteSetting (used by the /retry endpoint
   *  if we ever want to test a candidate URL). Defaults to the saved one. */
  urlOverride?: string;
}

/**
 * Posts the payload to the configured webhook URL and updates the
 * matching ContactMessage with the outcome. Never throws — all errors
 * are recorded as `failed` / `skipped` and returned via the result.
 */
export async function sendContactWebhook(
  payload: ContactWebhookPayload,
  opts: SendOptions = {},
): Promise<{ status: "success" | "failed" | "skipped"; error: string | null; httpStatus?: number }> {
  let url = opts.urlOverride;
  if (!url) {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "contact_webhook_url" },
    });
    url = setting?.value || undefined;
  }

  if (!url) {
    await recordOutcome(payload.id, "skipped", "No webhook URL configured");
    return { status: "skipped", error: "No webhook URL configured" };
  }

  try {
    await validateWebhookUrl(url);
  } catch (err) {
    const msg = `Invalid URL: ${truncateError(err)}`;
    await recordOutcome(payload.id, "skipped", msg);
    return { status: "skipped", error: msg };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
  } catch (err) {
    const msg = truncateError(err);
    await recordOutcome(payload.id, "failed", msg);
    return { status: "failed", error: msg };
  }

  if (!response.ok) {
    const msg = `HTTP ${response.status} ${response.statusText}`;
    await recordOutcome(payload.id, "failed", msg);
    return { status: "failed", error: msg, httpStatus: response.status };
  }

  await recordOutcome(payload.id, "success", null);
  return { status: "success", error: null, httpStatus: response.status };
}

/** Build the payload from a stored ContactMessage (used by the retry endpoint). */
export async function buildPayloadFromStored(messageId: number): Promise<ContactWebhookPayload | null> {
  const m = await prisma.contactMessage.findUnique({
    where: { id: messageId },
    include: { category: true },
  });
  if (!m) return null;
  return {
    id: m.id,
    submittedAt: m.createdAt.toISOString(),
    data: {
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      phone: m.phone,
      categoryId: m.categoryId,
      categorySlug: m.category?.slug ?? null,
      categoryLabel: m.category?.nameFr || m.categoryLabel,
      message: m.message,
      locale: m.locale,
    },
  };
}
