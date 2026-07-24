import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

import Fastify from "fastify";


// No session by default: the cron path must work on the secret alone. Tests
// that need an ADMIN flip `authContext.current`.
const authContext = vi.hoisted(() => ({
  current: null as { user: { id: string; email: string; name: string; role: string } } | null,
}));

vi.mock("../lib/auth-context.js", () => ({
  getAuthContext: async () => authContext.current,
}));

const { default: maintenanceRoutes } = await import("../routes/maintenance.js");
const { prisma } = await import("../lib/prisma.js");
const { softDeleteData, parkUniqueValue } = await import("../lib/admin-helpers.js");
const { isValidPurgeSecret, retentionDays, purgeExpiredTrash } = await import("../lib/trash-purge.js");

const SECRET = "test-purge-secret-0123456789";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(maintenanceRoutes, { prefix: "/api" });
  return app;
}

const createdArticleIds: number[] = [];

beforeEach(() => {
  process.env.TRASH_PURGE_SECRET = SECRET;
  authContext.current = null;
});

afterEach(async () => {
  delete process.env.TRASH_PURGE_SECRET;
  delete process.env.TRASH_RETENTION_DAYS;
  if (createdArticleIds.length) {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
    createdArticleIds.length = 0;
  }
});

/** An article already in the trash, deleted `daysAgo` days ago. */
async function trashedArticle(slug: string, daysAgo: number) {
  const article = await prisma.article.create({
    data: {
      slug,
      titleFr: `Titre ${slug}`,
      titleEn: `Title ${slug}`,
      contentFr: "<p>x</p>",
      contentEn: "<p>x</p>",
      publicationStatus: "DRAFT",
    },
  });
  createdArticleIds.push(article.id);

  const deletedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await prisma.article.update({
    where: { id: article.id },
    data: { ...softDeleteData(deletedAt), slug: parkUniqueValue(slug, article.id) },
  });
  return article;
}

describe("purge secret (#149)", () => {
  it("accepts the configured secret", () => {
    expect(isValidPurgeSecret(SECRET)).toBe(true);
  });

  it("rejects a wrong secret of the same length", () => {
    // Same length on purpose: this is the case a length check alone would pass.
    const wrong = "x".repeat(SECRET.length);
    expect(wrong.length).toBe(SECRET.length);
    expect(isValidPurgeSecret(wrong)).toBe(false);
  });

  it("rejects a prefix of the real secret", () => {
    expect(isValidPurgeSecret(SECRET.slice(0, 10))).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidPurgeSecret(undefined)).toBe(false);
  });

  it("denies everything when no secret is configured", () => {
    delete process.env.TRASH_PURGE_SECRET;
    // The dangerous failure mode is "no secret set" meaning "let anyone in".
    expect(isValidPurgeSecret("anything")).toBe(false);
    expect(isValidPurgeSecret("")).toBe(false);
  });
});

describe("retention window (#149)", () => {
  it("defaults to 30 days", () => {
    expect(retentionDays()).toBe(30);
  });

  it("honours the environment override", () => {
    process.env.TRASH_RETENTION_DAYS = "7";
    expect(retentionDays()).toBe(7);
  });

  it("falls back on a nonsensical value rather than purging everything", () => {
    // "0" would mean "delete the whole trash right now" — a typo must not do that.
    process.env.TRASH_RETENTION_DAYS = "0";
    expect(retentionDays()).toBe(30);
    process.env.TRASH_RETENTION_DAYS = "-5";
    expect(retentionDays()).toBe(30);
    process.env.TRASH_RETENTION_DAYS = "abc";
    expect(retentionDays()).toBe(30);
  });
});

describe("POST /api/maintenance/purge-trash (#149)", () => {
  it("401s without a secret or a session", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/maintenance/purge-trash" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("401s on a wrong secret", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/maintenance/purge-trash",
      headers: { "x-purge-secret": "nope" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("401s for an EDITOR session — this destroys data", async () => {
    authContext.current = {
      user: { id: "e", email: "e@test.local", name: "Ed", role: "EDITOR" },
    };
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/maintenance/purge-trash" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("accepts an ADMIN session, so it can be triggered by hand", async () => {
    authContext.current = {
      user: { id: "a", email: "a@test.local", name: "Ad", role: "ADMIN" },
    };
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/maintenance/purge-trash" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("purges what is past the window and keeps what is not", async () => {
    const stamp = Date.now();
    const old = await trashedArticle(`zz-purge-old-${stamp}`, 40);
    const recent = await trashedArticle(`zz-purge-recent-${stamp}`, 5);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/maintenance/purge-trash",
      headers: { "x-purge-secret": SECRET },
    });
    expect(res.statusCode).toBe(200);

    expect(await prisma.article.findUnique({ where: { id: old.id } })).toBeNull();
    // The whole point of a grace period: 5 days in, it is still recoverable.
    expect(await prisma.article.findUnique({ where: { id: recent.id } })).not.toBeNull();

    await app.close();
  });

  it("never touches live rows", async () => {
    const slug = `zz-purge-live-${Date.now()}`;
    const live = await prisma.article.create({
      data: {
        slug,
        titleFr: "Vivant",
        titleEn: "Live",
        contentFr: "<p>x</p>",
        contentEn: "<p>x</p>",
        publicationStatus: "PUBLISHED",
      },
    });
    createdArticleIds.push(live.id);

    const app = await buildApp();
    await app.inject({
      method: "POST",
      url: "/api/maintenance/purge-trash",
      headers: { "x-purge-secret": SECRET },
    });

    expect(await prisma.article.findUnique({ where: { id: live.id } })).not.toBeNull();
    await app.close();
  });

  it("is idempotent — a second run finds nothing left", async () => {
    const old = await trashedArticle(`zz-purge-idem-${Date.now()}`, 40);
    const app = await buildApp();

    const first = await app.inject({
      method: "POST",
      url: "/api/maintenance/purge-trash",
      headers: { "x-purge-secret": SECRET },
    });
    const firstArticles = first.json().entities.find((e: { entity: string }) => e.entity === "articles");
    expect(firstArticles.purged).toBeGreaterThanOrEqual(1);

    // A cron that fires twice, or retries after a timeout, must be harmless.
    const second = await app.inject({
      method: "POST",
      url: "/api/maintenance/purge-trash",
      headers: { "x-purge-secret": SECRET },
    });
    const secondArticles = second.json().entities.find((e: { entity: string }) => e.entity === "articles");
    expect(secondArticles.purged).toBe(0);

    expect(await prisma.article.findUnique({ where: { id: old.id } })).toBeNull();
    await app.close();
  });

  it("reports the cutoff it used", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/maintenance/purge-trash",
      headers: { "x-purge-secret": SECRET },
    });
    const body = res.json();
    expect(body.retentionDays).toBe(30);
    expect(new Date(body.cutoff).getTime()).toBeLessThan(Date.now());
    expect(Array.isArray(body.entities)).toBe(true);
    await app.close();
  });

  it("respects a custom retention window", async () => {
    process.env.TRASH_RETENTION_DAYS = "3";
    // 5 days old: kept under the 30-day default, purged under a 3-day window.
    const article = await trashedArticle(`zz-purge-window-${Date.now()}`, 5);

    await purgeExpiredTrash();

    expect(await prisma.article.findUnique({ where: { id: article.id } })).toBeNull();
  });
});
