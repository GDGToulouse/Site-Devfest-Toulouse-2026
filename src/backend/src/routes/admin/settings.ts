import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

interface CfpBody {
  isOpen: boolean;
  sessionizeUrl?: string;
  openDate?: string;
  closeDate?: string;
}

interface KeyFigureBody {
  icon: string;
  value: string;
  labelFr: string;
  labelEn: string;
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

  // GET /api/admin/settings/key-figures
  app.get("/settings/key-figures", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "key_figure_" } },
      orderBy: { key: "asc" },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const figures: KeyFigureBody[] = [];

    for (let i = 1; i <= 10; i++) {
      const prefix = `key_figure_${i}`;
      const icon = settingsMap.get(`${prefix}_icon`);
      if (!icon) break;

      figures.push({
        icon,
        value: settingsMap.get(`${prefix}_value`) || "0",
        labelFr: settingsMap.get(`${prefix}_label_fr`) || "",
        labelEn: settingsMap.get(`${prefix}_label_en`) || "",
      });
    }

    return figures;
  });

  // PUT /api/admin/settings/key-figures
  app.put<{
    Body: KeyFigureBody[];
  }>("/settings/key-figures", async (request) => {
    const figures = request.body;

    // Delete all existing key figures
    await prisma.siteSetting.deleteMany({
      where: { key: { startsWith: "key_figure_" } },
    });

    // Recreate
    for (let i = 0; i < figures.length; i++) {
      const prefix = `key_figure_${i + 1}`;
      const fig = figures[i];
      await prisma.siteSetting.createMany({
        data: [
          { key: `${prefix}_icon`, value: fig.icon },
          { key: `${prefix}_value`, value: fig.value },
          { key: `${prefix}_label_fr`, value: fig.labelFr },
          { key: `${prefix}_label_en`, value: fig.labelEn },
        ],
      });
    }

    return { success: true, count: figures.length };
  });
}
