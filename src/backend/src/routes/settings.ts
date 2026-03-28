import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings/key-figures — returns structured key figures from SiteSettings
  app.get("/settings/key-figures", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "key_figure_" } },
      orderBy: { key: "asc" },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const figures = [];

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
}
