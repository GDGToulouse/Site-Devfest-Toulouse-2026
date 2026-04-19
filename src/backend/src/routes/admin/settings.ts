import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateCfp, revalidateHome } from "../../lib/revalidate.js";
import { validateWebhookUrl } from "../../lib/webhook-url.js";

interface CfpBody {
  isOpen: boolean;
  sessionizeUrl?: string;
  openDate?: string;
  closeDate?: string;
}

const GENERAL_PREFIXES = ["contact_", "social_", "seo_"];

export default async function adminSettingsRoutes(app: FastifyInstance) {
  // GET /api/admin/settings/general
  app.get("/settings/general", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: {
        OR: GENERAL_PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })),
      },
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  });

  // PUT /api/admin/settings/general
  app.put<{ Body: Record<string, string> }>("/settings/general", async (request) => {
    const body = request.body;

    for (const [key, value] of Object.entries(body)) {
      if (!GENERAL_PREFIXES.some((p) => key.startsWith(p))) continue;
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return { success: true };
  });
  // GET /api/admin/settings/cfp
  app.get("/settings/cfp", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "cfp_" } },
    });
    const map = new Map(settings.map((s: (typeof settings)[number]) => [s.key, s.value]));

    return {
      isOpen: map.get("cfp_is_open") === "true",
      sessionizeUrl: map.get("cfp_sessionize_url") || null,
      openDate: map.get("cfp_open_date") || null,
      closeDate: map.get("cfp_close_date") || null,
    };
  });

  // PUT /api/admin/settings/cfp
  app.put<{ Body: CfpBody }>("/settings/cfp", async (request) => {
    const body = request.body;

    const entries = [
      { key: "cfp_is_open", value: String(body.isOpen) },
      { key: "cfp_sessionize_url", value: body.sessionizeUrl || "" },
      { key: "cfp_open_date", value: body.openDate || "" },
      { key: "cfp_close_date", value: body.closeDate || "" },
    ];

    for (const entry of entries) {
      await prisma.siteSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: { key: entry.key, value: entry.value },
      });
    }

    // CFP changes affect both the home (CTA in hero/header) and the
    // dedicated /proposer-un-talk page (status + dates + button).
    revalidateCfp();
    return { success: true };
  });

  // POST /api/admin/settings/test-webhook — send a test payload to a webhook URL
  // Body { url? }: when set, tests this URL directly (lets the admin probe a
  // candidate URL without saving). Falls back to the stored contact_webhook_url
  // if no body URL is provided.
  app.post<{ Body: { url?: string } }>("/settings/test-webhook", async (request, reply) => {
    let webhookUrl = request.body?.url?.trim();
    if (!webhookUrl) {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: "contact_webhook_url" },
      });
      webhookUrl = setting?.value;
    }
    if (!webhookUrl) return reply.status(400).send({ error: "No webhook URL provided" });

    // Validate the URL against SSRF before touching it. The admin is trusted
    // to point elsewhere but we refuse internal/loopback/private-IP targets
    // unconditionally — this is also our primary defense for the stored
    // webhook used by real submissions (defense in depth).
    try {
      await validateWebhookUrl(webhookUrl);
    } catch (err) {
      return reply.status(400).send({
        error: "invalid_webhook_url",
        reason: String((err as Error).message ?? err),
      });
    }

    // Use a real category if one exists, so the test payload mirrors what
    // a genuine submission would produce (id + slug + label all set).
    const sampleCategory = await prisma.contactCategory.findFirst({
      where: { slug: "sponsoring" },
    });

    const payload = {
      id: `test_${Date.now()}`,
      submittedAt: new Date().toISOString(),
      data: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+33 6 00 00 00 00",
        categoryId: sampleCategory?.id ?? null,
        categorySlug: sampleCategory?.slug ?? null,
        categoryLabel: sampleCategory?.nameFr ?? null,
        message: "Ceci est un message de test envoyé depuis le back-office pour vérifier la configuration du webhook.",
        locale: "fr",
      },
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
        redirect: "manual",
      });
      const responseBody = await response.text().catch(() => "");
      return {
        status: response.ok ? "sent" : "failed",
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 500),
      };
    } catch (err) {
      return {
        status: "failed",
        responseStatus: null,
        responseBody: String(err),
      };
    }
  });
}
