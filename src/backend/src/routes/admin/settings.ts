import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

interface CfpBody {
  isOpen: boolean;
  sessionizeUrl?: string;
  openDate?: string;
  closeDate?: string;
}

export default async function adminSettingsRoutes(app: FastifyInstance) {
  // GET /api/admin/settings/cfp
  app.get("/settings/cfp", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "cfp_" } },
    });
    const map = new Map(settings.map((s) => [s.key, s.value]));

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

    return { success: true };
  });

}
