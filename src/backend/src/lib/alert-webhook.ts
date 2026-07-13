import { prisma } from "./prisma.js";
import { validateWebhookUrl } from "./webhook-url.js";

// Alerting channel for server errors (#118). Reuses the webhook conventions
// already in place for contact submissions: URL stored in SiteSetting,
// SSRF-validated, hard timeout, never throws.

const TIMEOUT_MS = 10_000;
const ERROR_MAX_LEN = 500;

// A burst of 5xx must not flood the channel: the same error signature is only
// alerted once per window. Kept in memory — a restart re-arms alerting, which
// is the safe direction (we'd rather re-notify than stay silent).
const THROTTLE_MS = 5 * 60 * 1000;
const lastSentAt = new Map<string, number>();

export interface AlertPayload {
  // "server_error" today; the field leaves room for other alert kinds.
  kind: "server_error";
  environment: string;
  occurredAt: string;
  method: string;
  // Route pattern (e.g. /api/talks/:slug), not the raw URL: no query string,
  // no path parameters — nothing user-identifying reaches the channel (RGPD).
  route: string;
  statusCode: number;
  error: string;
}

function truncate(text: string): string {
  return text.length > ERROR_MAX_LEN ? `${text.slice(0, ERROR_MAX_LEN)}…` : text;
}

// The env var wins over the stored setting on purpose: reading SiteSetting
// needs the database, so a database outage — the incident we most want to hear
// about — would silence the alert. ALERT_WEBHOOK_URL keeps alerting alive when
// nothing else works; the admin-configurable setting stays the convenient path
// for everything else.
async function getAlertWebhookUrl(): Promise<string | undefined> {
  const fromEnv = process.env.ALERT_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "alert_webhook_url" },
    });
    return setting?.value || undefined;
  } catch {
    // Database unreachable — nothing more we can do without the env var.
    return undefined;
  }
}

// True when this signature was already alerted within the throttle window.
export function isThrottled(signature: string, now: number): boolean {
  const previous = lastSentAt.get(signature);
  if (previous !== undefined && now - previous < THROTTLE_MS) return true;
  lastSentAt.set(signature, now);
  return false;
}

export function resetThrottle(): void {
  lastSentAt.clear();
}

/**
 * Posts an alert to the configured webhook. Never throws: alerting must not
 * take the API down. Returns what happened so callers can log it.
 */
export async function sendAlert(
  payload: AlertPayload,
  opts: { urlOverride?: string } = {},
): Promise<{ status: "success" | "failed" | "skipped" | "throttled"; error: string | null }> {
  const url = opts.urlOverride ?? (await getAlertWebhookUrl());
  if (!url) return { status: "skipped", error: "No alert webhook URL configured" };

  // Throttle on route + status + error text, so a repeated failure is reported
  // once per window while a *different* failure still gets through immediately.
  if (!opts.urlOverride) {
    const signature = `${payload.route}|${payload.statusCode}|${payload.error}`;
    if (isThrottled(signature, Date.now())) {
      return { status: "throttled", error: null };
    }
  }

  try {
    await validateWebhookUrl(url);
  } catch (err) {
    return { status: "skipped", error: `Invalid URL: ${truncate(String(err))}` };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    if (!response.ok) {
      return { status: "failed", error: `HTTP ${response.status} ${response.statusText}` };
    }
    return { status: "success", error: null };
  } catch (err) {
    return { status: "failed", error: truncate(err instanceof Error ? err.message : String(err)) };
  }
}

export function buildAlertPayload(input: {
  method: string;
  route: string;
  statusCode: number;
  error: unknown;
}): AlertPayload {
  return {
    kind: "server_error",
    environment: process.env.ENV_NAME || "local",
    occurredAt: new Date().toISOString(),
    method: input.method,
    route: input.route,
    statusCode: input.statusCode,
    error: truncate(input.error instanceof Error ? input.error.message : String(input.error)),
  };
}
