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

}
