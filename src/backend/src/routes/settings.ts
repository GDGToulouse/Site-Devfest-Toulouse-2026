import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings/key-figures — returns key figures for the current edition
  app.get("/settings/key-figures", async () => {
    const currentEdition =
      (await prisma.edition.findFirst({
        where: { status: "ANNOUNCEMENT" },
      })) ??
      (await prisma.edition.findFirst({
        orderBy: { year: "desc" },
      }));

    if (!currentEdition) return [];

    const figures = await prisma.keyFigure.findMany({
      where: { editionId: currentEdition.id },
      orderBy: { sortOrder: "asc" },
    });

    return figures.map((f) => ({
      icon: f.icon,
      value: f.value,
      labelFr: f.labelFr,
      labelEn: f.labelEn,
    }));
  });

  // GET /api/settings/cfp — returns CFP configuration
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
}
