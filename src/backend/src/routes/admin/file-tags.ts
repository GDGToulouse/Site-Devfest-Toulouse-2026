import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";

import { prisma } from "../../lib/prisma.js";
import { UPLOADS_DIR } from "../../lib/image-store.js";
import { slugify } from "../../lib/slug.js";

// Media library tags (#373): sorting files by subject — logos, edition photos,
// illustrations. Created on the fly from a file's sheet, like article tags;
// renaming and merging are not part of this (decision on the issue).

const nameBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: { name: { type: "string", minLength: 1, maxLength: 60 } },
} as const;

const tagSelect = { id: true, name: true, slug: true } as const;

export default async function adminFileTagRoutes(app: FastifyInstance) {
  // GET /api/admin/file-tags — every tag, alphabetical, with how many files carry it.
  app.get("/file-tags", async () => {
    const tags = await prisma.fileTag.findMany({
      orderBy: { name: "asc" },
      select: { ...tagSelect, _count: { select: { files: true } } },
    });
    return tags.map(({ _count, ...tag }) => ({ ...tag, fileCount: _count.files }));
  });

  // POST /api/admin/file-tags — create one. A name already taken, by spelling or
  // by slug ("Logos" and "logos"), answers 409 with the existing tag so the
  // screen can pick it instead.
  app.post<{ Body: { name: string } }>("/file-tags", { schema: { body: nameBody } }, async (request, reply) => {
    const name = request.body.name.trim();
    const slug = slugify(name);
    if (!name || !slug) return reply.status(400).send({ error: "name is required" });

    const existing = await prisma.fileTag.findFirst({
      where: { OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }] },
      select: tagSelect,
    });
    if (existing) return reply.status(409).send({ error: "tag_exists", existing });

    return reply.status(201).send(await prisma.fileTag.create({ data: { name, slug }, select: tagSelect }));
  });

  // PUT /api/admin/files/:filename/tags — the file's whole tag list. Its
  // metadata row exists only once something was set on it (alt, name…), so it
  // is upserted: tagging a bare file must not be lost silently.
  app.put<{ Params: { filename: string }; Body: { tagIds: number[] } }>("/files/:filename/tags", {
    schema: {
      body: {
        type: "object",
        required: ["tagIds"],
        additionalProperties: false,
        properties: { tagIds: { type: "array", maxItems: 50, uniqueItems: true, items: { type: "integer", minimum: 1 } } },
      },
    },
  }, async (request, reply) => {
    const { filename } = request.params;
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return reply.code(400).send({ error: "Invalid filename" });
    }
    try {
      await fs.promises.access(path.join(UPLOADS_DIR, filename));
    } catch {
      return reply.code(404).send({ error: "File not found" });
    }

    const { tagIds } = request.body;
    const found = await prisma.fileTag.count({ where: { id: { in: tagIds } } });
    if (found !== tagIds.length) return reply.code(422).send({ error: "unknown_tag" });

    const connect = tagIds.map((id) => ({ id }));
    const meta = await prisma.fileMetadata.upsert({
      where: { filename },
      create: { filename, tags: { connect } },
      update: { tags: { set: connect } },
      select: { tags: { select: tagSelect, orderBy: { name: "asc" } } },
    });
    return { filename, tags: meta.tags };
  });
}
