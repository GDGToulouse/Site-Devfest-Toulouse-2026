import { prisma } from "./prisma.js";

// The gallery of an edition (#112), as the public page shows it.

/**
 * The photos in the team's order, each with an alt text: the one set on the
 * photo, else the one the media library holds for the file, else none — the
 * page then says which edition the photo is from.
 */
export async function editionGallery(editionId: number): Promise<{ id: number; url: string; alt: string | null }[]> {
  const photos = await prisma.editionPhoto.findMany({
    where: { editionId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, url: true, alt: true },
  });
  const filenames = photos.filter((p) => !p.alt).map((p) => p.url.replace(/^\/uploads\//, ""));
  const metadata = filenames.length
    ? await prisma.fileMetadata.findMany({ where: { filename: { in: filenames } }, select: { filename: true, alt: true } })
    : [];
  const altOf = new Map(metadata.map((m) => [m.filename, m.alt]));
  return photos.map((p) => ({ id: p.id, url: p.url, alt: p.alt || altOf.get(p.url.replace(/^\/uploads\//, "")) || null }));
}
