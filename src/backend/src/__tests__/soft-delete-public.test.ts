import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";

import { buildApp } from "./test-app.js";
import talkRoutes from "../routes/talks.js";
import { prisma } from "../lib/prisma.js";
import { softDeleteData, parkUniqueValue } from "../lib/admin-helpers.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// `test-app.ts` does not register the public talk routes, so the category test
// builds its own app. Without this it 404s on every call, and asserting
// `.category` on an error body silently passes (undefined !== null).
async function buildTalkApp() {
  const app = Fastify({ logger: false });
  await app.register(talkRoutes, { prefix: "/api" });
  return app;
}

// Part A filtered the admin reads and left the public ones untouched. A trashed
// article was still served on `/api/articles/:slug` — a 200 on content the
// organizers had deleted. These tests exist so that regression cannot come back
// silently: nothing in the type system or the existing suite caught it.

const createdArticleIds: number[] = [];
const createdTalkIds: number[] = [];
const createdCategoryIds: number[] = [];

afterEach(async () => {
  // Hard-delete the fixtures — soft delete is the thing under test, so cleaning
  // up through it would leave rows behind on every run. Cleanup lives here
  // rather than at the end of each test: a failing assertion aborts the test
  // body, and inline cleanup would never run.
  if (createdArticleIds.length) {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
    createdArticleIds.length = 0;
  }
  if (createdTalkIds.length) {
    await prisma.talk.deleteMany({ where: { id: { in: createdTalkIds } } });
    createdTalkIds.length = 0;
  }
  if (createdCategoryIds.length) {
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    createdCategoryIds.length = 0;
  }
});

async function createArticle(slug: string) {
  const article = await prisma.article.create({
    data: {
      slug,
      titleFr: "Article de test corbeille",
      titleEn: "Trash test article",
      contentFr: "<p>Contenu.</p>",
      contentEn: "<p>Content.</p>",
      publicationStatus: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  createdArticleIds.push(article.id);
  return article;
}

async function trashArticle(id: number, slug: string) {
  await prisma.article.update({
    where: { id },
    data: { ...softDeleteData(), slug: parkUniqueValue(slug, id) },
  });
}

describe("public API hides trashed content (#147)", () => {
  it("404s on a trashed article instead of serving it", async () => {
    const app = await buildApp();
    const slug = `zz-public-trash-${Date.now()}`;
    const article = await createArticle(slug);

    const live = await app.inject({ method: "GET", url: `/api/articles/${slug}` });
    expect(live.statusCode).toBe(200);

    await trashArticle(article.id, slug);

    const trashed = await app.inject({ method: "GET", url: `/api/articles/${slug}` });
    expect(trashed.statusCode).toBe(404);

    await app.close();
  });

  it("404s on the parked slug too, so the internal prefix is not a live URL", async () => {
    const app = await buildApp();
    const slug = `zz-public-parked-${Date.now()}`;
    const article = await createArticle(slug);
    await trashArticle(article.id, slug);

    // Parking rewrites the slug in place. Without a deletedAt filter the row is
    // still reachable — just under `__trash_<id>__…`, which leaks the marker.
    const parked = await prisma.article.findUnique({ where: { id: article.id } });
    const res = await app.inject({ method: "GET", url: `/api/articles/${parked!.slug}` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it("drops the trashed article from the public list", async () => {
    const app = await buildApp();
    const slug = `zz-public-list-${Date.now()}`;
    const article = await createArticle(slug);

    const before = await app.inject({ method: "GET", url: "/api/articles?page=1" });
    expect(JSON.stringify(before.json())).toContain(slug);

    await trashArticle(article.id, slug);

    const after = await app.inject({ method: "GET", url: "/api/articles?page=1" });
    expect(JSON.stringify(after.json())).not.toContain(slug);

    await app.close();
  });

  it("keeps a live talk but drops its category once the category is trashed", async () => {
    const app = await buildTalkApp();
    const edition = await getSeededEdition();

    const category = await prisma.category.create({
      data: {
        nameFr: `ZZ Piste test ${Date.now()}`,
        nameEn: "ZZ Test track",
        color: "#123456",
        editions: { create: { editionId: edition.id } },
      },
    });
    createdCategoryIds.push(category.id);
    const talk = await prisma.talk.create({
      data: {
        editionId: edition.id,
        categoryId: category.id,
        title: "ZZ Talk with a trashed category",
        description: "Checks the to-one relation case.",
        slug: `zz-cat-trash-${Date.now()}`,
        format: "CONFERENCE",
        language: "fr",
        publicationStatus: "PUBLISHED",
      },
    });
    createdTalkIds.push(talk.id);

    // Assert the status first: `.category` on a 404 body is `undefined`, which
    // would slip past `not.toBeNull()` and make this test pass while proving
    // nothing.
    const before = await app.inject({ method: "GET", url: `/api/talks/${talk.slug}` });
    expect(before.statusCode).toBe(200);
    expect(before.json().category).toMatchObject({ nameFr: category.nameFr });

    // A to-one relation takes no `where` in Prisma, so the query cannot filter
    // this out — only the serializer can. Without that, the trashed category
    // would keep rendering its coloured badge on the public page.
    await prisma.category.update({ where: { id: category.id }, data: softDeleteData() });

    const after = await app.inject({ method: "GET", url: `/api/talks/${talk.slug}` });
    expect(after.statusCode).toBe(200); // the talk itself is untouched
    expect(after.json().category).toBeNull();

    await app.close();
  });
});
