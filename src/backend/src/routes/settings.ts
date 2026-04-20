import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "./editions.js";

export default async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings/key-figures — returns key figures for the featured edition
  app.get("/settings/key-figures", async () => {
    const currentEdition = await getFeaturedEdition();
    if (!currentEdition) return [];

    const figures = await prisma.keyFigure.findMany({
      where: { editionId: currentEdition.id },
      orderBy: { sortOrder: "asc" },
    });

    return figures.map((f: (typeof figures)[number]) => ({
      icon: f.icon,
      value: f.value,
      labelFr: f.labelFr,
      labelEn: f.labelEn,
    }));
  });

  // GET /api/settings/featured-edition — returns the ID of the featured edition
  app.get("/settings/featured-edition", async () => {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "featured_edition_id" },
    });

    return { editionId: setting ? Number(setting.value) : null };
  });

  // GET /api/settings/social — returns social media links
  app.get("/settings/social", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "social_" } },
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  });

  // GET /api/settings/cfp — returns CFP configuration
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

  // GET /api/settings/seo — returns SEO settings
  app.get("/settings/seo", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "seo_" } },
    });
    const result: Record<string, string> = {};
    for (const s of settings as (typeof settings)[number][]) {
      result[s.key] = s.value;
    }
    return result;
  });

  // GET /api/settings/identity — returns brand identity assets (logos + favicons).
  // Consumed by the frontend layout (favicon metadata) and by Header/Footer to
  // pick the right logo variant. All values are URLs (typically /uploads/...).
  app.get("/settings/identity", async () => {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "identity_" } },
    });
    const result: Record<string, string> = {};
    for (const s of settings as (typeof settings)[number][]) {
      result[s.key] = s.value;
    }
    return result;
  });

  // GET /api/settings/ecosystem — returns the ordered list of ecosystem partners
  // displayed on the home page and in the footer. Stored as a JSON-encoded
  // array under the single key `ecosystem_partners`.
  app.get("/settings/ecosystem", async () => {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "ecosystem_partners" },
    });
    if (!setting?.value) return [];
    try {
      const parsed = JSON.parse(setting.value) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (p): p is { name: string; url: string; isFeatured?: boolean } =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as { name?: unknown }).name === "string" &&
            typeof (p as { url?: unknown }).url === "string",
        )
        .map((p) => ({
          name: p.name,
          url: p.url,
          isFeatured: Boolean(p.isFeatured),
        }));
    } catch {
      return [];
    }
  });
}
