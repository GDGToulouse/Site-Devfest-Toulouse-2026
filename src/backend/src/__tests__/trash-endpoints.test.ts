import { describe, it, expect, afterEach, vi } from "vitest";

import Fastify from "fastify";

// The purge route carries its own `requireAdminRole`, so unlike the other admin
// test apps this one cannot simply skip the guards — the route would 403. The
// auth context is stubbed instead, which lets the ADMIN-only rule be tested for
// real: `describe("purge authorisation")` at the bottom drives it as an EDITOR
// and expects a refusal.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-admin", email: "admin@test.local", name: "Test", role: "ADMIN" } },
}));

vi.mock("../lib/auth-context.js", () => ({
  getAuthContext: async () => authContext.current,
}));

const { default: adminTrashRoutes } = await import("../routes/admin/trash.js");
const { default: adminArticleRoutes } = await import("../routes/admin/articles.js");
const { prisma } = await import("../lib/prisma.js");
const { softDeleteData, parkUniqueValue } = await import("../lib/admin-helpers.js");
const { countFileReferences } = await import("../lib/trash-files.js");

async function buildTrashApp() {
  const app = Fastify({ logger: false });
  await app.register(adminTrashRoutes, { prefix: "/api/admin" });
  await app.register(adminArticleRoutes, { prefix: "/api/admin" });
  return app;
}

const createdArticleIds: number[] = [];

afterEach(async () => {
  if (createdArticleIds.length) {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
    createdArticleIds.length = 0;
  }
});

async function createArticle(slug: string, imageUrl?: string) {
  const article = await prisma.article.create({
    data: {
      slug,
      titleFr: `Titre ${slug}`,
      titleEn: `Title ${slug}`,
      contentFr: "<p>x</p>",
      contentEn: "<p>x</p>",
      publicationStatus: "PUBLISHED",
      ...(imageUrl ? { imageUrl } : {}),
    },
  });
  createdArticleIds.push(article.id);
  return article;
}

async function trash(id: number, slug: string) {
  await prisma.article.update({
    where: { id },
    data: { ...softDeleteData(), slug: parkUniqueValue(slug, id) },
  });
}

describe("trash endpoints (#148)", () => {
  it("lists a trashed row and unparks its label", async () => {
    const app = await buildTrashApp();
    const slug = `zz-trash-list-${Date.now()}`;
    const article = await createArticle(slug);
    await trash(article.id, slug);

    const res = await app.inject({ method: "GET", url: "/api/admin/trash/articles" });
    expect(res.statusCode).toBe(200);

    const found = res.json().items.find((i: { id: number }) => i.id === article.id);
    expect(found).toBeDefined();
    expect(found.deletedAt).not.toBeNull();
    // titleFr is not a parked field, so it shows as-is — the point is that no
    // `__trash_` marker leaks into what the admin reads.
    expect(found.label).not.toContain("__trash_");

    await app.close();
  });

  it("restores a row and gives its slug back", async () => {
    const app = await buildTrashApp();
    const slug = `zz-trash-restore-${Date.now()}`;
    const article = await createArticle(slug);
    await trash(article.id, slug);

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/trash/articles/${article.id}/restore`,
    });
    expect(res.statusCode).toBe(200);

    const restored = await prisma.article.findUnique({ where: { id: article.id } });
    expect(restored?.deletedAt).toBeNull();
    expect(restored?.slug).toBe(slug);

    await app.close();
  });

  it("refuses to restore when the slug was taken meanwhile, naming the field", async () => {
    const app = await buildTrashApp();
    const slug = `zz-trash-conflict-${Date.now()}`;
    const article = await createArticle(slug);
    await trash(article.id, slug);

    // Parking freed the slug — so something else can legitimately claim it.
    const squatter = await createArticle(slug);

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/trash/articles/${article.id}/restore`,
    });

    // A raw Prisma unique-constraint error would surface as a 500 here.
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("restore_conflict");
    expect(res.json().fields).toContain("slug");

    // The row must stay in the trash, untouched.
    const still = await prisma.article.findUnique({ where: { id: article.id } });
    expect(still?.deletedAt).not.toBeNull();
    expect(still?.id).not.toBe(squatter.id);

    await app.close();
  });

  it("purges a trashed row for good", async () => {
    const app = await buildTrashApp();
    const slug = `zz-trash-purge-${Date.now()}`;
    const article = await createArticle(slug);
    await trash(article.id, slug);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/trash/articles/${article.id}/purge`,
    });
    expect(res.statusCode).toBe(200);

    const gone = await prisma.article.findUnique({ where: { id: article.id } });
    expect(gone).toBeNull();

    await app.close();
  });

  it("refuses to purge a row that is not in the trash", async () => {
    const app = await buildTrashApp();
    const slug = `zz-trash-live-${Date.now()}`;
    const article = await createArticle(slug);

    // The guard that keeps a stray call from destroying live data.
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/trash/articles/${article.id}/purge`,
    });
    expect(res.statusCode).toBe(404);

    const alive = await prisma.article.findUnique({ where: { id: article.id } });
    expect(alive).not.toBeNull();

    await app.close();
  });

  it("keeps a shared upload when another row still points at it", async () => {
    const app = await buildTrashApp();
    const shared = "/uploads/zz-shared-fixture.png";
    const slugA = `zz-share-a-${Date.now()}`;
    const slugB = `zz-share-b-${Date.now()}`;

    const a = await createArticle(slugA, shared);
    await createArticle(slugB, shared);
    await trash(a.id, slugA);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/trash/articles/${a.id}/purge`,
    });
    expect(res.statusCode).toBe(200);

    // Real data already had one image on two articles; deleting the file with
    // the row would have broken the survivor's illustration.
    const outcome = res.json().files.find((f: { url: string }) => f.url === shared);
    expect(outcome.deleted).toBe(false);
    expect(outcome.reason).toBe("still_referenced");

    await app.close();
  });

  it("counts references across entities, not just within one", async () => {
    const slug = `zz-refcount-${Date.now()}`;
    const url = "/uploads/zz-refcount-fixture.png";
    const article = await createArticle(slug, url);

    // Excluding the only holder leaves nothing.
    expect(await countFileReferences(url, { model: "article", id: article.id })).toBe(0);
    // Excluding a different row still sees it.
    expect(await countFileReferences(url, { model: "article", id: article.id + 999999 })).toBe(1);
  });

  it("404s on an unknown entity rather than guessing", async () => {
    const app = await buildTrashApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/trash/nonexistent" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("refuses the purge to an EDITOR, and still lets them restore", async () => {
    const app = await buildTrashApp();
    const slug = `zz-trash-editor-${Date.now()}`;
    const article = await createArticle(slug);
    await trash(article.id, slug);

    const asAdmin = authContext.current;
    authContext.current = {
      user: { id: "test-editor", email: "editor@test.local", name: "Ed", role: "EDITOR" },
    };

    try {
      // Destroying a row for good is not an editor's call.
      const purge = await app.inject({
        method: "DELETE",
        url: `/api/admin/trash/articles/${article.id}/purge`,
      });
      expect(purge.statusCode).toBe(403);

      const stillThere = await prisma.article.findUnique({ where: { id: article.id } });
      expect(stillThere).not.toBeNull();

      // Restoring is reversible, so editors keep it.
      const restore = await app.inject({
        method: "POST",
        url: `/api/admin/trash/articles/${article.id}/restore`,
      });
      expect(restore.statusCode).toBe(200);
    } finally {
      authContext.current = asAdmin;
    }

    await app.close();
  });

  it("keeps an EDITOR out of ADMIN-only entities, list and restore alike", async () => {
    const app = await buildTrashApp();
    const asAdmin = authContext.current;
    authContext.current = {
      user: { id: "test-editor", email: "editor@test.local", name: "Ed", role: "EDITOR" },
    };

    try {
      // The trash must not become a side door around the per-entity role rules.
      // `users` is labelled by email, so listing alone would leak admin
      // addresses; restoring a trashed admin account escalates privilege.
      for (const key of ["users", "editions", "ticket-tiers", "sponsor-tiers"]) {
        const list = await app.inject({ method: "GET", url: `/api/admin/trash/${key}` });
        expect(list.statusCode, `GET ${key}`).toBe(403);

        const restore = await app.inject({
          method: "POST",
          url: `/api/admin/trash/${key}/1/restore`,
        });
        expect(restore.statusCode, `restore ${key}`).toBe(403);
      }

      // Editorial entities stay reachable — that is the whole point of the split.
      const articles = await app.inject({ method: "GET", url: "/api/admin/trash/articles" });
      expect(articles.statusCode).toBe(200);
    } finally {
      authContext.current = asAdmin;
    }

    await app.close();
  });

  it("hides ADMIN-only entities from an EDITOR's summary", async () => {
    const app = await buildTrashApp();
    const asAdmin = authContext.current;

    const adminView = await app.inject({ method: "GET", url: "/api/admin/trash" });
    const adminKeys = adminView.json().entities.map((e: { entity: string }) => e.entity);
    expect(adminKeys).toContain("users");

    authContext.current = {
      user: { id: "test-editor", email: "editor@test.local", name: "Ed", role: "EDITOR" },
    };
    try {
      const editorView = await app.inject({ method: "GET", url: "/api/admin/trash" });
      const editorKeys = editorView.json().entities.map((e: { entity: string }) => e.entity);
      expect(editorKeys).not.toContain("users");
      expect(editorKeys).not.toContain("editions");
      expect(editorKeys).toContain("articles");
    } finally {
      authContext.current = asAdmin;
    }

    await app.close();
  });

  it("reports a per-entity summary with a total", async () => {
    const app = await buildTrashApp();
    const slug = `zz-trash-summary-${Date.now()}`;
    const article = await createArticle(slug);
    await trash(article.id, slug);

    const res = await app.inject({ method: "GET", url: "/api/admin/trash" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    const articles = body.entities.find((e: { entity: string }) => e.entity === "articles");
    expect(articles.count).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThanOrEqual(articles.count);

    await app.close();
  });
});
