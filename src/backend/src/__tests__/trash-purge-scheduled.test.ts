import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { softDeleteData, parkUniqueValue } from "../lib/admin-helpers.js";
import { runTrashPurge } from "../lib/scheduler.js";

// #664 — the scheduled purge runs against the real database and must leave its
// mark in the history as the system's doing. Sequential, like trash-purge.test:
// a purge sweeps every trashed row of the shared database.

const createdArticleIds: number[] = [];

afterEach(async () => {
  delete process.env.TRASH_RETENTION_DAYS;
  if (createdArticleIds.length) {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
    await prisma.auditLog.deleteMany({ where: { entity: "Article", entityId: { in: createdArticleIds.map(String) } } });
    createdArticleIds.length = 0;
  }
});

async function trashedArticle(slug: string, daysAgo: number) {
  const article = await prisma.article.create({
    data: { slug, titleFr: slug, titleEn: slug, contentFr: "<p>x</p>", contentEn: "<p>x</p>", publicationStatus: "DRAFT" },
  });
  createdArticleIds.push(article.id);
  const deletedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await prisma.article.update({ where: { id: article.id }, data: { ...softDeleteData(deletedAt), slug: parkUniqueValue(slug, article.id) } });
  return article;
}

const silent = { info: () => {}, warn: () => {}, error: () => {} };

describe("runTrashPurge (#664)", () => {
  it("should destroy what is past the retention window and file it under the system", async () => {
    process.env.TRASH_RETENTION_DAYS = "30";
    const old = await trashedArticle(`sched-old-${Date.now()}`, 45);
    const recent = await trashedArticle(`sched-recent-${Date.now()}`, 5);

    await runTrashPurge(silent as never);

    expect(await prisma.article.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.article.findUnique({ where: { id: recent.id } })).not.toBeNull();
    const logged = await prisma.auditLog.findFirst({ where: { entity: "Article", entityId: String(old.id), action: "DELETE" } });
    expect(logged).toMatchObject({ channel: "SYSTEM", actorUserId: null, actorLabel: "Purge de la corbeille" });
  });
});
