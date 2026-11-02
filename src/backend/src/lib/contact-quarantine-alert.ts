import { prisma } from "./prisma.js";
import { validateWebhookUrl } from "./webhook-url.js";
import { postJson } from "./safe-fetch.js";

// Tells the team a contact message went to quarantine (#767). Its own setting,
// apart from contact_webhook_url: that one is a contract n8n parses (the full
// message, link included), and this alert must carry nothing the visitor typed
// — no name, no text, no link — only where to look. `{ text }` is what a Slack
// incoming webhook expects, so no relay is needed.
//
// Same conventions as lib/alert-webhook.ts: SSRF-validated, hard timeout,
// never throws. Without a URL, the quarantine shows in the admin only.

const TIMEOUT_MS = 10_000;

export async function sendQuarantineAlert(): Promise<{ status: "success" | "failed" | "skipped"; error: string | null }> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "contact_quarantine_webhook_url" } });
  const url = setting?.value?.trim();
  if (!url) return { status: "skipped", error: "No quarantine webhook URL configured" };

  try {
    await validateWebhookUrl(url);
  } catch (err) {
    return { status: "skipped", error: `Invalid URL: ${String(err)}` };
  }

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const text = `Message suspect à vérifier sur le formulaire de contact : ${baseUrl}/admin/contact/messages?filtre=quarantaine`;

  try {
    const response = await postJson(url, { text }, { timeoutMs: TIMEOUT_MS });
    if (response.status < 200 || response.status >= 300) {
      return { status: "failed", error: `HTTP ${response.status} ${response.statusText}` };
    }
    return { status: "success", error: null };
  } catch (err) {
    return { status: "failed", error: String(err) };
  }
}
