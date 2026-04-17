import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateHome } from "../../lib/revalidate.js";

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

    revalidateHome();
    return { success: true };
  });

  // POST /api/admin/settings/test-webhook — send a test payload to contact_webhook_url
  app.post("/settings/test-webhook", async (_request, reply) => {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "contact_webhook_url" },
    });
    const webhookUrl = setting?.value;
    if (!webhookUrl) return reply.status(400).send({ error: "No webhook URL configured (contact_webhook_url)" });

    const payload = {
      id: `test_${Date.now()}`,
      submittedAt: new Date().toISOString(),
      data: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+33 6 00 00 00 00",
        categoryId: null,
        categorySlug: "sponsoring",
        categoryLabel: "Sponsoring",
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
