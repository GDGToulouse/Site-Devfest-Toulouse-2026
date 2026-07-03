import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  isConfigured,
  QuotaExhaustedError,
  sharedRateLimiter,
  translate,
  TranslationError,
  type Format,
  type Lang,
  type Quality,
  type SourceLang,
} from "../../lib/translation/index.js";

interface TranslateBody {
  content?: string;
  sourceLang?: SourceLang;
  targetLang?: Lang;
  format?: Format;
  quality?: Quality;
  glossary?: Record<string, string>;
}

export default async function adminTranslateRoutes(app: FastifyInstance) {
  // POST /api/admin/translate — translate a single content string.
  app.post<{ Body: TranslateBody }>("/translate", async (request, reply) => {
    if (!isConfigured()) {
      return reply.status(503).send({
        error: "not_configured",
        message: "Translation service is not configured (missing GEMINI_API_KEY).",
      });
    }

    const body = request.body || {};
    const userId = request.adminUser?.id ?? null;

    try {
      const result = await translate(
        {
          content: body.content ?? "",
          sourceLang: body.sourceLang ?? "auto",
          targetLang: body.targetLang ?? "en",
          format: body.format ?? "html",
          quality: body.quality,
          glossary: body.glossary,
        },
        { userId },
      );
      return result;
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        return reply
          .status(429)
          .header("Retry-After", String(err.retryAfterSec ?? 60))
          .send({
            error: err.code,
            message: err.message,
            retryAfterSec: err.retryAfterSec,
          });
      }
      if (err instanceof TranslationError) {
        const status =
          err.code === "invalid_input" ? 400 :
          err.code === "content_too_large" ? 413 :
          err.code === "rate_limit" ? 429 :
          err.code === "not_configured" ? 503 :
          err.code === "tag_mismatch" || err.code === "placeholder_mismatch" ? 422 :
          502;
        return reply.status(status).send({ error: err.code, message: err.message });
      }
      request.log.error({ err }, "Unexpected translation error");
      return reply.status(500).send({ error: "internal_error" });
    }
  });

  // GET /api/admin/translate/stats — usage stats + quota snapshot.
  // Used by the admin dashboard to show "X translations today, Y remaining".
  app.get("/translate/stats", async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [last24h, last7d, byStatus24h, byUser24h] = await Promise.all([
      prisma.translationLog.count({ where: { createdAt: { gte: since24h } } }),
      prisma.translationLog.count({ where: { createdAt: { gte: since7d } } }),
      prisma.translationLog.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since24h } },
        _count: true,
      }),
      prisma.translationLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: since24h }, userId: { not: null } },
        _count: true,
        orderBy: { _count: { userId: "desc" } },
        take: 10,
      }),
    ]);

    return {
      configured: isConfigured(),
      quota: sharedRateLimiter.snapshot(),
      counts: { last24h, last7d },
      statusBreakdown24h: byStatus24h.map((b) => ({ status: b.status, count: b._count })),
      topUsers24h: byUser24h.map((u) => ({ userId: u.userId, count: u._count })),
    };
  });
}
