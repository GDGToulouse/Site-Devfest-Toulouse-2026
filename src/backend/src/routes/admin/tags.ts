import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound, parkUniqueValue, softDeleteData } from "../../lib/admin-helpers.js";
import { revalidateArticle, revalidateTagPage } from "../../lib/revalidate.js";
import { slugify } from "../../lib/slug.js";

// The articles' tags (#376). They used to be created on the fly from the
// article form and never maintained: no screen renamed, merged or removed one,
// so "Logos", "logo" and "Logo sponsors" ended up side by side. Moved out of
// the articles module, where only the autocomplete and the creation lived.

const idParams = { type: "object", required: ["id"], properties: { id: { type: "string", pattern: "^[0-9]+$" } } } as const;
const nameBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: { name: { type: "string", minLength: 1, maxLength: 100 } },
} as const;

// Who holds a name or slug. Deliberately NOT filtered on deletedAt: both are
// database-wide unique constraints, so a trashed tag still owns them until
// purged. Parking frees the readable form, but a row keeping unparked values
// (restored, or trashed before #147) must still be detected.
async function findHolder(name: string, slug: string, exceptId?: number) {
  return prisma.tag.findFirst({
    where: { OR: [{ name }, { slug }], ...(exceptId !== undefined && { id: { not: exceptId } }) },
    select: { id: true, name: true, deletedAt: true },
  });
}

// Every page a tag change shows on: the articles carrying it, its own listing.
async function revalidateTagged(tagId: number, tagSlugs: string[]) {
  const articles = await prisma.article.findMany({
    where: { ...notDeleted, tags: { some: { id: tagId } } },
    select: { slug: true },
  });
  await Promise.all([...articles.map((a) => revalidateArticle(a.slug)), ...tagSlugs.map((s) => revalidateTagPage(s))]);
}

export default async function adminTagRoutes(app: FastifyInstance) {
  // GET /api/admin/tags — every live tag with the number of live articles using
  // it, so a stray one is visible before anyone removes it.
  app.get("/tags", async () => {
    const tags = await prisma.tag.findMany({
      where: notDeleted,
      orderBy: { name: "asc" },
      include: { _count: { select: { articles: { where: notDeleted } } } },
    });
    return tags.map(({ _count, ...tag }) => ({ ...tag, articleCount: _count.articles }));
  });

  // POST /api/admin/tags — create one, from the article form's autocomplete.
  app.post<{ Body: { name: string } }>("/tags", { schema: { body: nameBody } }, async (request, reply) => {
    const name = request.body.name.trim();
    if (!name) return reply.status(400).send({ error: "name is required" });
    const slug = slugify(name);

    if (await findHolder(name, slug)) return reply.status(409).send({ error: "Tag already exists" });

    const tag = await prisma.tag.create({ data: { name, slug } });
    return reply.status(201).send(tag);
  });

  // PUT /api/admin/tags/:id — rename. The slug follows; the articles stay
  // linked, since the link is the id. A name another live tag holds is refused
  // with that tag's id: the intent is almost always a merge.
  app.put<{ Params: { id: string }; Body: { name: string } }>("/tags/:id", {
    schema: { params: idParams, body: nameBody },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const tag = await prisma.tag.findFirst({ where: { id, ...notDeleted } });
    if (!tag) return notFound(reply, "Tag");

    const name = request.body.name.trim();
    const slug = slugify(name);
    if (!name || !slug) return reply.status(400).send({ error: "name is required" });

    const holder = await findHolder(name, slug, id);
    if (holder) {
      return reply.status(409).send(
        holder.deletedAt
          ? { error: "tag_in_trash", message: "Ce nom appartient à un tag de la corbeille : restaurez-le ou videz la corbeille." }
          : { error: "tag_exists", existingId: holder.id, existingName: holder.name, message: `« ${holder.name} » existe déjà : fusionnez plutôt les deux tags.` },
      );
    }

    const updated = await prisma.tag.update({ where: { id }, data: { name, slug } });
    await revalidateTagged(id, [tag.slug, slug]);
    return updated;
  });

  // POST /api/admin/tags/:id/merge — move every article of this tag onto
  // `targetId`, then send this one to the trash. Repairs spelling duplicates.
  app.post<{ Params: { id: string }; Body: { targetId: number } }>("/tags/:id/merge", {
    schema: {
      params: idParams,
      body: { type: "object", required: ["targetId"], additionalProperties: false, properties: { targetId: { type: "integer" } } },
    },
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const { targetId } = request.body;
    if (id === targetId) return reply.status(400).send({ error: "same_tag", message: "Choisissez un autre tag que celui-ci." });

    const [source, target] = await Promise.all([
      prisma.tag.findFirst({ where: { id, ...notDeleted } }),
      prisma.tag.findFirst({ where: { id: targetId, ...notDeleted } }),
    ]);
    if (!source || !target) return notFound(reply, "Tag");

    // Every article of the source, trashed ones included: a restored article
    // must come back under the surviving tag, not under one in the trash.
    const articles = await prisma.article.findMany({
      where: { tags: { some: { id } } },
      select: { id: true, slug: true, deletedAt: true },
    });

    await prisma.$transaction([
      // `connect` on a link already there is a no-op: an article carrying both
      // tags keeps a single link to the target.
      ...articles.map((a) =>
        prisma.article.update({
          where: { id: a.id },
          data: { tags: { connect: { id: targetId }, disconnect: { id } } },
        }),
      ),
      prisma.tag.update({
        where: { id },
        data: { ...softDeleteData(), name: parkUniqueValue(source.name, id), slug: parkUniqueValue(source.slug, id) },
      }),
    ]);

    await Promise.all([
      ...articles.filter((a) => !a.deletedAt).map((a) => revalidateArticle(a.slug)),
      revalidateTagPage(source.slug),
      revalidateTagPage(target.slug),
    ]);
    return { merged: true, targetId, movedArticles: articles.length };
  });

  // DELETE /api/admin/tags/:id — to the trash (#147). The articles keep their
  // link, so a restore brings the tag back where it was.
  app.delete<{ Params: { id: string } }>("/tags/:id", { schema: { params: idParams } }, async (request, reply) => {
    const id = Number(request.params.id);
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
    await revalidateTagged(id, [existing.slug]);
    return { success: true };
  });
}
