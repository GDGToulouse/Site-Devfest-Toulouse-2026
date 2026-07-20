import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { revalidateArticle } from "../../lib/revalidate.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import { missingArticleFields } from "../../lib/article-validation.js";
import { notDeleted, notFound, parkUniqueValue, softDeleteData } from "../../lib/admin-helpers.js";
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
  // Optional at creation (#262) — filled in later by hand or by AI translation.
  titleEn?: string;
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

    const where = status
      ? { publicationStatus: status as "DRAFT" | "PUBLISHED", ...notDeleted }
      : { ...notDeleted };

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        // Nested reads need their own filter: a query extension would not reach
        // them (Prisma applies those to the top-level operation only), and a
        // trashed tag or edition would otherwise still show up on a live article.
        include: { tags: { where: notDeleted }, editions: { where: notDeleted } },
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

    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const article = await prisma.article.findFirst({
      where: { id, ...notDeleted },
      include: { tags: { where: notDeleted }, editions: { where: notDeleted } },
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

    // Drafts stay permissive, publishing is strict (#263). titleEn in particular
    // is optional until publication: the AI translation only runs on an
    // already-saved article, so requiring it up front made a FR-only draft
    // impossible to create (#262).
    const targetStatus = body.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const missing = missingArticleFields(body, targetStatus);
    if (missing.length) {
      return reply.status(400).send({
        error: targetStatus === "PUBLISHED"
          ? `Publication impossible, champs manquants : ${missing.join(", ")}`
          : `Champs obligatoires manquants : ${missing.join(", ")}`,
        fields: missing,
      });
    }

    // Deliberately NOT filtered on deletedAt: uniqueness is a database-wide
    // constraint, so a trashed article still owns its slug until purged. Parking
    // frees the readable form, but a row keeping an unparked slug (restored, or
    // trashed before #147) must still be detected or the create would collide.
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
        titleEn: body.titleEn?.trim() || "",
        contentFr: sanitizeRichHtml(body.contentFr),
        contentEn: sanitizeRichHtml(body.contentEn),
        excerptFr: body.excerptFr?.trim() || null,
        excerptEn: body.excerptEn?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        author: body.author?.trim() || null,
        publicationStatus: body.publicationStatus || "DRAFT",
        publishedAt: isPublished ? overrideDate ?? new Date() : null,
        autoTranslatedFr: body.autoTranslatedFr ?? false,
        autoTranslatedEn: body.autoTranslatedEn ?? false,
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

    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const existing = await prisma.article.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return reply.status(404).send({ error: "Article not found" });

    const body = request.body;
    const isPublished = body.publicationStatus === "PUBLISHED";
    const wasPublished = existing.publicationStatus === "PUBLISHED";
    const overrideDate = parsePublishedAt(body.publishedAt);

    const newContentFr = body.contentFr !== undefined ? sanitizeRichHtml(body.contentFr) : existing.contentFr;
    const newContentEn = body.contentEn !== undefined ? sanitizeRichHtml(body.contentEn) : existing.contentEn;

    // Validate what the article will look like once merged, not just the body:
    // a partial update flipping the status to PUBLISHED must still be complete
    // (#263). Publishing is the gate, saving a draft never fails on completeness.
    const targetStatus = body.publicationStatus === "PUBLISHED"
      ? "PUBLISHED"
      : body.publicationStatus === "DRAFT"
        ? "DRAFT"
        : existing.publicationStatus;
    const merged = {
      slug: body.slug?.trim() || existing.slug,
      titleFr: body.titleFr?.trim() || existing.titleFr,
      titleEn: body.titleEn?.trim() || existing.titleEn,
      contentFr: newContentFr,
      contentEn: newContentEn,
    };
    const missing = missingArticleFields(merged, targetStatus);
    if (missing.length) {
      return reply.status(400).send({
        error: targetStatus === "PUBLISHED"
          ? `Publication impossible, champs manquants : ${missing.join(", ")}`
          : `Champs obligatoires manquants : ${missing.join(", ")}`,
        fields: missing,
      });
    }

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

    // findFirst, not findUnique: the latter only accepts unique fields in its
    // top-level where, so it cannot carry the `deletedAt` filter (#147).
    const article = await prisma.article.findFirst({ where: { id, ...notDeleted } });
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

  // DELETE /api/admin/articles/:id — moves the article to the trash (#147). The
  // row survives with `deletedAt` set; #145c restores it, #145d purges it.
  app.delete<{
    Params: { id: string };
  }>("/articles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.article.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Article");

    // The slug is globally unique and a trashed row keeps its slot, so park it
    // out of the live namespace — otherwise re-creating an article under the
    // same slug would hit the constraint (#146).
    await prisma.article.update({
      where: { id },
      data: { ...softDeleteData(), slug: parkUniqueValue(existing.slug, id) },
    });
    revalidateArticle(existing.slug);
    return { success: true };
  });

  // GET /api/admin/tags — list all tags
  app.get("/tags", async () => {
    return prisma.tag.findMany({ where: notDeleted, orderBy: { name: "asc" } });
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

    // Deliberately NOT filtered on deletedAt: both `name` and `slug` are
    // database-wide unique constraints, so a trashed tag still owns them until
    // purged. Parking frees the readable form, but a row keeping unparked
    // values (restored, or trashed before #147) must still be detected.
    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) return reply.status(409).send({ error: "Tag already exists" });

    const tag = await prisma.tag.create({ data: { name, slug } });
    return reply.status(201).send(tag);
  });

  // DELETE /api/admin/tags/:id — moves the tag to the trash (#147).
  app.delete<{
    Params: { id: string };
  }>("/tags/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid ID" });

    const existing = await prisma.tag.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return notFound(reply, "Tag");

    // Both `name` and `slug` are globally unique and a trashed row keeps its
    // slots, so park them both — otherwise re-creating a tag under the same
    // name would hit either constraint (#146).
    await prisma.tag.update({
      where: { id },
      data: {
        ...softDeleteData(),
        name: parkUniqueValue(existing.name, id),
        slug: parkUniqueValue(existing.slug, id),
      },
    });
    return { success: true };
  });
}
