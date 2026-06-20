import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateArticle } from "../../lib/revalidate.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import {
  isConfigured as translationConfigured,
  QuotaExhaustedError,
  translate,
  TranslationError,
  type Lang,
} from "../../lib/translation/index.js";

// Returns a valid Date when an ISO string is supplied, otherwise null.
// Used to let callers (e.g. content imports) preserve an original date
// instead of stamping "now".
function parsePublishedAt(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

interface ArticleBody {
  slug: string;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  excerptFr?: string;
  excerptEn?: string;
  imageUrl?: string;
  author?: string;
  publicationStatus?: "DRAFT" | "PUBLISHED";
  // ISO date string. When provided (e.g. imports preserving an original
  // publication date), it overrides the default "now" stamp.
  publishedAt?: string;
  editionIds?: number[];
  tagIds?: number[];
  // When the editor manually edits a field that was AI-translated, the UI
  // sends the corresponding flag to false to clear the "auto" badge.
  autoTranslatedFr?: boolean;
  autoTranslatedEn?: boolean;
}

export default async function adminArticleRoutes(app: FastifyInstance) {
  // GET /api/admin/articles — list all articles (including drafts), with pagination
  app.get<{
    Querystring: { page?: string; limit?: string; status?: string };
  }>("/articles", async (request) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const limit = Math.min(Number(request.query.limit) || 20, 100);
    const status = request.query.status;

    const where = status ? { publicationStatus: status as "DRAFT" | "PUBLISHED" } : {};

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: { tags: true, editions: true },
      }),
      prisma.article.count({ where }),
    ]);

    return {
      articles: articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        titleFr: a.titleFr,
        titleEn: a.titleEn,
        excerptFr: a.excerptFr,
        excerptEn: a.excerptEn,
        imageUrl: a.imageUrl,
        author: a.author,
        publicationStatus: a.publicationStatus,
        publishedAt: a.publishedAt,
        createdAt: a.createdAt,
        tags: a.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
        editions: a.editions.map((e: { id: number; year: number }) => ({ id: e.id, year: e.year })),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  });

  // GET /api/admin/articles/:id — single article for editing
  app.get<{
    Params: { id: string };
  }>("/articles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const article = await prisma.article.findUnique({
      where: { id },
      include: { tags: true, editions: true },
    });

    if (!article) return reply.status(404).send({ error: "Article not found" });

    return {
      id: article.id,
      slug: article.slug,
      titleFr: article.titleFr,
      titleEn: article.titleEn,
      contentFr: article.contentFr,
      contentEn: article.contentEn,
      excerptFr: article.excerptFr,
      excerptEn: article.excerptEn,
      imageUrl: article.imageUrl,
      author: article.author,
      publicationStatus: article.publicationStatus,
      publishedAt: article.publishedAt,
      autoTranslatedFr: article.autoTranslatedFr,
      autoTranslatedEn: article.autoTranslatedEn,
      translatedAtFr: article.translatedAtFr,
      translatedAtEn: article.translatedAtEn,
      editions: article.editions.map((e: { id: number; year: number }) => ({ id: e.id, year: e.year })),
      tags: article.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    };
  });

  // POST /api/admin/articles — create article
  app.post<{ Body: ArticleBody }>("/articles", async (request, reply) => {
    const body = request.body;

    if (!body.slug?.trim() || !body.titleFr?.trim() || !body.titleEn?.trim()) {
      return reply.status(400).send({ error: "slug, titleFr, titleEn are required" });
    }

    const existing = await prisma.article.findUnique({ where: { slug: body.slug.trim() } });
    if (existing) {
      return reply.status(409).send({ error: "An article with this slug already exists" });
    }

    const isPublished = body.publicationStatus === "PUBLISHED";
    const overrideDate = parsePublishedAt(body.publishedAt);

    const article = await prisma.article.create({
      data: {
        slug: body.slug.trim(),
        titleFr: body.titleFr.trim(),
        titleEn: body.titleEn.trim(),
        contentFr: sanitizeRichHtml(body.contentFr),
        contentEn: sanitizeRichHtml(body.contentEn),
        excerptFr: body.excerptFr?.trim() || null,
        excerptEn: body.excerptEn?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        author: body.author?.trim() || null,
        publicationStatus: body.publicationStatus || "DRAFT",
        publishedAt: isPublished ? overrideDate ?? new Date() : null,
        editions: body.editionIds?.length ? { connect: body.editionIds.map((id) => ({ id })) } : undefined,
        tags: body.tagIds?.length ? { connect: body.tagIds.map((id) => ({ id })) } : undefined,
      },
      include: { tags: true },
    });

    revalidateArticle(article.slug);
    return reply.status(201).send({ id: article.id, slug: article.slug });
  });

  // PUT /api/admin/articles/:id — update article
  app.put<{
    Params: { id: string };
    Body: ArticleBody;
  }>("/articles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Article not found" });

    const body = request.body;
    const isPublished = body.publicationStatus === "PUBLISHED";
    const wasPublished = existing.publicationStatus === "PUBLISHED";
    const overrideDate = parsePublishedAt(body.publishedAt);

    const newContentFr = body.contentFr !== undefined ? sanitizeRichHtml(body.contentFr) : existing.contentFr;
    const newContentEn = body.contentEn !== undefined ? sanitizeRichHtml(body.contentEn) : existing.contentEn;

    // If the editor sent an explicit flag, honour it. Otherwise auto-clear
    // the auto-translated flag whenever the corresponding content actually
    // changed: a manual edit by definition means "I have reviewed this".
    const nextAutoFr = body.autoTranslatedFr !== undefined
      ? body.autoTranslatedFr
      : (newContentFr !== existing.contentFr ? false : existing.autoTranslatedFr);
    const nextAutoEn = body.autoTranslatedEn !== undefined
      ? body.autoTranslatedEn
      : (newContentEn !== existing.contentEn ? false : existing.autoTranslatedEn);

    const article = await prisma.article.update({
      where: { id },
      data: {
        slug: body.slug?.trim() || existing.slug,
        titleFr: body.titleFr?.trim() || existing.titleFr,
        titleEn: body.titleEn?.trim() || existing.titleEn,
        contentFr: newContentFr,
        contentEn: newContentEn,
        excerptFr: body.excerptFr?.trim() ?? existing.excerptFr,
        excerptEn: body.excerptEn?.trim() ?? existing.excerptEn,
        imageUrl: body.imageUrl?.trim() ?? existing.imageUrl,
        author: body.author?.trim() ?? existing.author,
        publicationStatus: body.publicationStatus || existing.publicationStatus,
        publishedAt: overrideDate ?? (isPublished && !wasPublished ? new Date() : existing.publishedAt),
        autoTranslatedFr: nextAutoFr,
        autoTranslatedEn: nextAutoEn,
        editions: body.editionIds !== undefined
          ? { set: body.editionIds.map((editionId) => ({ id: editionId })) }
          : undefined,
        tags: body.tagIds !== undefined
          ? { set: body.tagIds.map((tagId) => ({ id: tagId })) }
          : undefined,
      },
      include: { tags: true },
    });

    // Revalidate both the old and new slug if renamed
    revalidateArticle(article.slug);
    if (existing.slug !== article.slug) revalidateArticle(existing.slug);
    return { id: article.id, slug: article.slug };
  });

  // POST /api/admin/articles/:id/translate-fields
  // Translates the article from one language to the other (title, excerpt,
  // content) and persists the result on the target side. The corresponding
  // autoTranslated* flag is set to true and translatedAt* stamped.
  // The editor still has to save the form afterwards if they edit anything;
  // this route writes immediately so partial failure on one field doesn't
  // leave the page in an inconsistent state.
  app.post<{
    Params: { id: string };
    Body: { from: Lang; quality?: "fast" | "high" };
  }>("/articles/:id/translate-fields", async (request, reply) => {
    if (!translationConfigured()) {
      return reply.status(503).send({ error: "not_configured" });
    }
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return reply.status(404).send({ error: "Article not found" });

    const from = request.body?.from;
    if (from !== "fr" && from !== "en") {
      return reply.status(400).send({ error: "from must be 'fr' or 'en'" });
    }
    const to: Lang = from === "fr" ? "en" : "fr";
    const userId = request.adminUser?.id ?? null;

    // Fan out the three field translations sequentially: the rate limiter
    // would block parallel calls anyway and it keeps quota accounting clean.
    const sourceTitle = from === "fr" ? article.titleFr : article.titleEn;
    const sourceExcerpt = from === "fr" ? article.excerptFr : article.excerptEn;
    const sourceContent = from === "fr" ? article.contentFr : article.contentEn;

    try {
      const titleOut = await translate(
        { content: sourceTitle, sourceLang: from, targetLang: to, format: "plain", quality: request.body?.quality },
        { userId },
      );
      const excerptOut = sourceExcerpt
        ? await translate(
            { content: sourceExcerpt, sourceLang: from, targetLang: to, format: "plain", quality: request.body?.quality },
            { userId },
          )
        : null;
      const contentOut = sourceContent
        ? await translate(
            { content: sourceContent, sourceLang: from, targetLang: to, format: "html", quality: request.body?.quality },
            { userId },
          )
        : null;

      const data: Record<string, unknown> = {};
      if (to === "en") {
        data.titleEn = titleOut.translatedContent;
        if (excerptOut) data.excerptEn = excerptOut.translatedContent;
        if (contentOut) data.contentEn = sanitizeRichHtml(contentOut.translatedContent);
        data.autoTranslatedEn = true;
        data.translatedAtEn = new Date();
      } else {
        data.titleFr = titleOut.translatedContent;
        if (excerptOut) data.excerptFr = excerptOut.translatedContent;
        if (contentOut) data.contentFr = sanitizeRichHtml(contentOut.translatedContent);
        data.autoTranslatedFr = true;
        data.translatedAtFr = new Date();
      }

      const updated = await prisma.article.update({ where: { id }, data });
      revalidateArticle(updated.slug);

      return {
        id: updated.id,
        targetLang: to,
        title: titleOut.translatedContent,
        excerpt: excerptOut?.translatedContent ?? null,
        content: contentOut ? (to === "en" ? updated.contentEn : updated.contentFr) : null,
        translatedAt: to === "en" ? updated.translatedAtEn : updated.translatedAtFr,
      };
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        return reply.status(429).header("Retry-After", String(err.retryAfterSec ?? 60)).send({
          error: err.code, message: err.message, retryAfterSec: err.retryAfterSec,
        });
      }
      if (err instanceof TranslationError) {
        const status =
          err.code === "invalid_input" ? 400 :
          err.code === "content_too_large" ? 413 :
          err.code === "tag_mismatch" || err.code === "placeholder_mismatch" ? 422 :
          502;
        return reply.status(status).send({ error: err.code, message: err.message });
      }
      request.log.error({ err }, "translate-fields failed");
      return reply.status(500).send({ error: "internal_error" });
    }
  });

  // DELETE /api/admin/articles/:id
  app.delete<{
    Params: { id: string };
  }>("/articles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Article not found" });

    await prisma.article.delete({ where: { id } });
    revalidateArticle(existing.slug);
    return { success: true };
  });

  // GET /api/admin/tags — list all tags
  app.get("/tags", async () => {
    return prisma.tag.findMany({ orderBy: { name: "asc" } });
  });

  // POST /api/admin/tags — create a tag
  app.post<{
    Body: { name: string };
  }>("/tags", async (request, reply) => {
    const name = request.body.name?.trim();
    if (!name) return reply.status(400).send({ error: "name is required" });

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) return reply.status(409).send({ error: "Tag already exists" });

    const tag = await prisma.tag.create({ data: { name, slug } });
    return reply.status(201).send(tag);
  });

  // DELETE /api/admin/tags/:id
  app.delete<{
    Params: { id: string };
  }>("/tags/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    await prisma.tag.delete({ where: { id } });
    return { success: true };
  });
}
