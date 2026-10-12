import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound } from "../../lib/admin-helpers.js";
import { isLocalUpload } from "../../lib/speaker-photo.js";
import { revalidateEdition } from "../../lib/revalidate.js";
import { requireAdminRole } from "../../lib/admin-guard.js";
import { editionGallery } from "../../lib/edition-photos.js";

// The gallery of an edition in the back-office (#112): photos picked from the
// media library, ordered and captioned. The team reads it; writing is an
// ADMIN's call like everything under an edition (#530), and the screen lives
// in the edition sheet, which only ADMINs reach.

const editionParams = { type: "object", required: ["id"], properties: { id: { type: "string", pattern: "^[0-9]+$" } } } as const;
const photoParams = { type: "object", required: ["photoId"], properties: { photoId: { type: "string", pattern: "^[0-9]+$" } } } as const;

async function findEdition(id: string) {
  return prisma.edition.findFirst({ where: { id: Number(id), ...notDeleted }, select: { id: true, year: true } });
}

export default async function adminEditionPhotoRoutes(app: FastifyInstance) {
  // GET /api/admin/editions/:id/photos — with the alt text the page will use.
  app.get<{ Params: { id: string } }>("/editions/:id/photos", { schema: { params: editionParams } }, async (request, reply) => {
    const edition = await findEdition(request.params.id);
    if (!edition) return notFound(reply, "Edition");
    const [gallery, own] = await Promise.all([
      editionGallery(edition.id),
      prisma.editionPhoto.findMany({ where: { editionId: edition.id }, select: { id: true, alt: true } }),
    ]);
    const ownAlt = new Map(own.map((p) => [p.id, p.alt]));
    return gallery.map((p) => ({ ...p, ownAlt: ownAlt.get(p.id) ?? null }));
  });

  // POST /api/admin/editions/:id/photos — appends a photo of the media library.
  app.post<{ Params: { id: string }; Body: { url: string; alt?: string } }>("/editions/:id/photos", {
    preHandler: [requireAdminRole],
    schema: {
      params: editionParams,
      body: {
        type: "object",
        required: ["url"],
        properties: { url: { type: "string", maxLength: 500 }, alt: { type: "string", maxLength: 300 } },
      },
    },
  }, async (request, reply) => {
    const edition = await findEdition(request.params.id);
    if (!edition) return notFound(reply, "Edition");
    // A photo of the media library only: a remote image is neither ours to
    // keep nor allowed by next/image.
    if (!isLocalUpload(request.body.url)) {
      return reply.code(422).send({ error: "not_an_upload", message: "Choisissez une image de la médiathèque." });
    }
    const last = await prisma.editionPhoto.aggregate({ where: { editionId: edition.id }, _max: { sortOrder: true } });
    const photo = await prisma.editionPhoto.create({
      data: {
        editionId: edition.id,
        url: request.body.url,
        alt: request.body.alt?.trim() || null,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    await revalidateEdition(edition.year);
    return reply.code(201).send(photo);
  });

  // PUT /api/admin/editions/:id/photos/order — the order of the gallery, as listed.
  app.put<{ Params: { id: string }; Body: { ids: number[] } }>("/editions/:id/photos/order", {
    preHandler: [requireAdminRole],
    schema: {
      params: editionParams,
      body: {
        type: "object",
        required: ["ids"],
        properties: { ids: { type: "array", items: { type: "integer", minimum: 1 }, maxItems: 1000, uniqueItems: true } },
      },
    },
  }, async (request, reply) => {
    const edition = await findEdition(request.params.id);
    if (!edition) return notFound(reply, "Edition");
    await prisma.$transaction(
      request.body.ids.map((id, index) =>
        prisma.editionPhoto.updateMany({ where: { id, editionId: edition.id }, data: { sortOrder: index } }),
      ),
    );
    await revalidateEdition(edition.year);
    return { success: true };
  });

  // PUT /api/admin/edition-photos/:photoId — the photo's own alt text; empty
  // falls back on the media library's.
  app.put<{ Params: { photoId: string }; Body: { alt: string } }>("/edition-photos/:photoId", {
    preHandler: [requireAdminRole],
    schema: {
      params: photoParams,
      body: { type: "object", required: ["alt"], properties: { alt: { type: "string", maxLength: 300 } } },
    },
  }, async (request, reply) => {
    const photo = await prisma.editionPhoto.findUnique({ where: { id: Number(request.params.photoId) }, include: { edition: { select: { year: true } } } });
    if (!photo) return notFound(reply, "Photo");
    const updated = await prisma.editionPhoto.update({ where: { id: photo.id }, data: { alt: request.body.alt.trim() || null } });
    await revalidateEdition(photo.edition.year);
    return updated;
  });

  // DELETE /api/admin/edition-photos/:photoId — out of the gallery; the file
  // itself stays in the media library.
  app.delete<{ Params: { photoId: string } }>("/edition-photos/:photoId", { preHandler: [requireAdminRole], schema: { params: photoParams } }, async (request, reply) => {
    const photo = await prisma.editionPhoto.findUnique({ where: { id: Number(request.params.photoId) }, include: { edition: { select: { year: true } } } });
    if (!photo) return notFound(reply, "Photo");
    await prisma.editionPhoto.delete({ where: { id: photo.id } });
    await revalidateEdition(photo.edition.year);
    return reply.code(204).send();
  });
}
