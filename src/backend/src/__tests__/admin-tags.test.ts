import { describe, it, expect, afterAll } from "vitest";

import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";

// #376 — the tags are maintained from the back-office: renamed, merged, removed,
// with their number of articles in view.

const stamp = `${Date.now()}-${Math.round(performance.now())}`;
const created = { tagIds: [] as number[], articleIds: [] as number[] };

async function createTag(name: string) {
  const tag = await prisma.tag.create({ data: { name: `${name} ${stamp}`, slug: `${name}-${stamp}`.toLowerCase() } });
  created.tagIds.push(tag.id);
  return tag;
}

async function createArticle(slug: string, tagIds: number[]) {
  const article = await prisma.article.create({
    data: {
      slug: `${slug}-${stamp}`,
      titleFr: slug,
      titleEn: slug,
      contentFr: "",
      contentEn: "",
      tags: { connect: tagIds.map((id) => ({ id })) },
    },
  });
  created.articleIds.push(article.id);
  return article;
}

async function tagIdsOf(articleId: number) {
  const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId }, include: { tags: true } });
  return article.tags.map((t) => t.id).sort();
}

afterAll(async () => {
  await prisma.article.deleteMany({ where: { id: { in: created.articleIds } } });
  await prisma.tag.deleteMany({ where: { id: { in: created.tagIds } } });
});

describe("Admin tags (#376)", () => {
  it("lists each tag with the number of articles using it", async () => {
    const app = await buildAdminApp();
    const tag = await createTag("Counted");
    await createArticle("counted-a", [tag.id]);
    await createArticle("counted-b", [tag.id]);

    const res = await app.inject({ method: "GET", url: "/api/admin/tags" });
    await app.close();

    expect(res.json().find((t: { id: number }) => t.id === tag.id)).toMatchObject({ articleCount: 2 });
  });

  it("renames a tag, its slug following, its articles still linked", async () => {
    const app = await buildAdminApp();
    const tag = await createTag("Logos");
    const article = await createArticle("renamed", [tag.id]);

    const res = await app.inject({ method: "PUT", url: `/api/admin/tags/${tag.id}`, payload: { name: `Logo sponsors ${stamp}` } });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: `Logo sponsors ${stamp}`, slug: `logo-sponsors-${stamp}` });
    expect(await tagIdsOf(article.id)).toEqual([tag.id]);
  });

  it("refuses a name another tag holds, and points at it for a merge", async () => {
    const app = await buildAdminApp();
    const kept = await createTag("Taken");
    const other = await createTag("Other");

    const res = await app.inject({ method: "PUT", url: `/api/admin/tags/${other.id}`, payload: { name: kept.name } });
    await app.close();

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "tag_exists", existingId: kept.id });
  });

  it("merges a tag into another without doubling a link, and trashes the source", async () => {
    const app = await buildAdminApp();
    const source = await createTag("logo");
    const target = await createTag("Logos-target");
    const onlySource = await createArticle("only-source", [source.id]);
    const both = await createArticle("both", [source.id, target.id]);

    const res = await app.inject({ method: "POST", url: `/api/admin/tags/${source.id}/merge`, payload: { targetId: target.id } });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(await tagIdsOf(onlySource.id)).toEqual([target.id]);
    expect(await tagIdsOf(both.id)).toEqual([target.id]);
    expect((await prisma.tag.findUniqueOrThrow({ where: { id: source.id } })).deletedAt).toBeInstanceOf(Date);
  });

  it("refuses to merge a tag into itself", async () => {
    const app = await buildAdminApp();
    const tag = await createTag("Self");

    const res = await app.inject({ method: "POST", url: `/api/admin/tags/${tag.id}/merge`, payload: { targetId: tag.id } });
    await app.close();

    expect(res.statusCode).toBe(400);
  });
});
