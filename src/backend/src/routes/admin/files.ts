import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../../lib/prisma.js";
import { originalNamesByUrl, rememberOriginalName } from "../../lib/file-metadata.js";
import { generateAltText } from "../../lib/alt-text.js";
import { UPLOADS_DIR, UnsafeSvgError } from "../../lib/image-store.js";
import { storeUpload, type StoredUpload } from "../../lib/upload-store.js";
import { fetchRemoteFile, RemoteFetchError } from "../../lib/safe-fetch.js";
import { EXTENSION_BY_MIME, sniffMime } from "../../lib/file-sniff.js";
import { TranslationError, sendTranslationError } from "../../lib/translation/errors.js";
import { listFileReferences, listFileUsages, type FileReferenceUsage } from "../../lib/trash-files.js";
import { FILE_PAGE_SIZE, pageFiles, type FileListType } from "../../lib/file-list.js";

const ALLOWED_MIMES = [
  // Images. SVG was excluded outright by #306 — served same-origin from
  // /uploads/, an SVG carrying <script> executes in our origin. It is allowed
  // again since #346, but only because storeImageBuffer strips scripts,
  // handlers and remote references before writing, and index.ts serves .svg
  // under a sandbox CSP. Removing either of those brings the hole back.
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/svg+xml",
  "image/x-icon", "image/vnd.microsoft.icon",
  // Documents
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_FILE_SIZE = 20_000_000; // 20 MB

// Why an import by URL was refused (#617), in the editor's words: what happened
// and what to do, not the code (#394).
const IMPORT_REFUSALS: Record<RemoteFetchError["code"], { status: number; message: string }> = {
  invalid_url: { status: 400, message: "Cette adresse n'est pas une URL valide." },
  invalid_protocol: { status: 400, message: "Seules les adresses http:// et https:// sont acceptées." },
  internal_hostname: { status: 400, message: "Cette adresse pointe vers le réseau interne : elle est refusée." },
  private_ip: { status: 400, message: "Cette adresse pointe vers un réseau privé : elle est refusée." },
  too_many_redirects: { status: 400, message: "Cette adresse redirige trop de fois. Donnez l'adresse finale du fichier." },
  http_error: { status: 502, message: "Le site distant n'a pas fourni le fichier. Vérifiez l'adresse." },
  too_large: { status: 413, message: "Le fichier dépasse 20 Mo." },
  timeout: { status: 504, message: "Le site distant n'a pas répondu à temps. Réessayez plus tard." },
  empty: { status: 502, message: "Le site distant a renvoyé un fichier vide." },
  network: { status: 502, message: "Le site distant est injoignable. Vérifiez l'adresse." },
};

interface FileListQuery {
  page?: string;
  limit?: string;
  type?: FileListType;
  ext?: string;
}

// What each model is called in the refusal shown to the admin (#486). The
// message has to name the place to go and fix it, not a Prisma delegate.
const USAGE_LABELS: Record<string, { one: string; many: string }> = {
  article: { one: "un article", many: "articles" },
  speaker: { one: "un speaker", many: "speakers" },
  sponsor: { one: "un sponsor", many: "sponsors" },
  editionSponsor: { one: "une participation sponsor", many: "participations sponsor" },
  edition: { one: "une édition", many: "éditions" },
  siteSetting: { one: "les réglages du site", many: "les réglages du site" },
};

function describeUsages(usages: readonly FileReferenceUsage[]): string {
  const parts = usages.map(({ model, count }) => {
    const label = USAGE_LABELS[model];
    if (!label) return `${count} ligne(s) « ${model} »`;
    return count > 1 ? `${count} ${label.many}` : label.one;
  });
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

export default async function adminFileRoutes(app: FastifyInstance) {
  // POST /api/admin/files — upload a single file (image or document)
  app.post("/files", async (request, reply) => {
    const data = await request.file({
      limits: { fileSize: MAX_FILE_SIZE },
    });

    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    // Some browsers send .ico with an empty or generic mimetype — accept it
    // when the extension is unambiguous.
    const ext = path.extname(data.filename).toLowerCase();
    const isIcoByExt = ext === ".ico";
    if (!ALLOWED_MIMES.includes(data.mimetype) && !isIcoByExt) {
      // Consume the stream to avoid hanging
      await data.toBuffer();
      return reply.code(400).send({
        error: `Invalid file type: ${data.mimetype}. Allowed: ${ALLOWED_MIMES.join(", ")}`,
      });
    }

    // Buffer the upload first so it can be written as-is or recompressed. The
    // stream is already capped at 20 MB via limits, so memory stays bounded.
    const buffer = await data.toBuffer();

    if (data.file.truncated) {
      return reply.code(413).send({ error: "File too large (max 20 MB)" });
    }

    let stored: StoredUpload;
    try {
      stored = await storeUpload(buffer, data.mimetype, ext || ".jpg", request.log);
    } catch (err) {
      if (err instanceof UnsafeSvgError) {
        return reply.code(400).send({ error: "Invalid SVG: nothing renderable left once scripts were removed" });
      }
      throw err;
    }
    const uniqueName = stored.filename;

    // Optional alt text passed in the same multipart payload (FormData
    // .append("alt", "...")). Stored on FileMetadata for accessibility —
    // empty string is treated as "no alt".
    const altField = (data.fields as Record<string, { value?: unknown }> | undefined)?.alt;
    const rawAlt = typeof altField?.value === "string" ? altField.value.trim() : "";
    const alt = rawAlt.length > 0 ? rawAlt : null;
    if (alt) {
      await prisma.fileMetadata.upsert({
        where: { filename: uniqueName },
        update: { alt },
        create: { filename: uniqueName, alt },
      });
    }

    // The name the editor's machine gave it (#378). The route already knew it —
    // it has always been echoed back in the response below — it simply never
    // survived the request.
    await rememberOriginalName(`/uploads/${uniqueName}`, data.filename);

    return {
      filename: uniqueName,
      originalName: data.filename,
      url: `/uploads/${uniqueName}`,
      size: stored.size,
      mimetype: data.mimetype,
      alt,
      // Compression telemetry — the UI tells the editor when the image was
      // downscaled or recompressed.
      compression: stored.compression,
    };
  });

  // POST /api/admin/files/import-url — the same as an upload, from a URL
  // (#617): an editor pastes a logo's address, an AI agent imports a batch of
  // logos through call_route, which only sends JSON. The server downloads the
  // file through fetchRemoteFile (SSRF guarded hop by hop, capped while it
  // reads) and stores it by the upload's own path.
  app.post<{ Body: { url: string; alt?: string | null } }>("/files/import-url", {
    schema: {
      body: {
        type: "object",
        required: ["url"],
        additionalProperties: false,
        properties: {
          url: { type: "string", minLength: 1, maxLength: 2048 },
          alt: { type: ["string", "null"], maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    let downloaded: { buffer: Buffer; url: URL };
    try {
      downloaded = await fetchRemoteFile(request.body.url.trim(), { maxBytes: MAX_FILE_SIZE });
    } catch (err) {
      if (err instanceof RemoteFetchError) {
        const { status, message } = IMPORT_REFUSALS[err.code];
        return reply.code(status).send({ error: err.code, message });
      }
      throw err;
    }

    // The bytes say what the file is, not the server's header nor the URL.
    const mimetype = sniffMime(downloaded.buffer);
    if (!mimetype || !ALLOWED_MIMES.includes(mimetype)) {
      return reply.code(400).send({
        error: "unsupported_type",
        message: "Ce fichier n'est pas une image (JPEG, PNG, WebP, GIF, SVG, ICO) ni un PDF.",
      });
    }

    let stored: StoredUpload;
    try {
      stored = await storeUpload(downloaded.buffer, mimetype, EXTENSION_BY_MIME[mimetype], request.log);
    } catch (err) {
      if (err instanceof UnsafeSvgError) {
        return reply.code(400).send({
          error: "unsafe_svg",
          message: "Ce SVG ne contient rien d'affichable une fois les scripts retirés.",
        });
      }
      throw err;
    }

    const alt = request.body.alt?.trim() || null;
    if (alt) {
      await prisma.fileMetadata.upsert({
        where: { filename: stored.filename },
        update: { alt },
        create: { filename: stored.filename, alt },
      });
    }
    // The name the file had at its source (#378): the last segment of the path
    // it was finally served from.
    const originalName = decodeURIComponent(downloaded.url.pathname.split("/").filter(Boolean).pop() ?? "") || undefined;
    await rememberOriginalName(`/uploads/${stored.filename}`, originalName);

    return reply.code(201).send({
      filename: stored.filename,
      originalName: originalName ?? null,
      url: `/uploads/${stored.filename}`,
      size: stored.size,
      mimetype,
      alt,
      compression: stored.compression,
    });
  });

  // GET /api/admin/files — the uploaded files, newest first. With `page`, one
  // page and the count of each tab (#416): the library rendered one <img> per
  // file and both pickers reloaded the whole catalogue. Without, the full array,
  // for the callers that still need everything.
  app.get<{ Querystring: FileListQuery }>("/files", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          page: { type: "string", pattern: "^[0-9]+$" },
          limit: { type: "string", pattern: "^[0-9]+$" },
          type: { type: "string", enum: ["images", "documents", "unused"] },
          // Comma-separated, e.g. `.pdf` for a picker that only takes PDFs.
          ext: { type: "string", pattern: "^\\.[a-z0-9]+(,\\.[a-z0-9]+)*$" },
        },
      },
    },
  }, async (request) => {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

    const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico"];

    const files = await fs.promises.readdir(UPLOADS_DIR);
    const filenames = files.filter((f) => f !== ".gitkeep");

    // Bulk-fetch all metadata in one query, then merge in memory — keeps
    // the listing O(N) on the filesystem and O(1) on the database.
    const metaRows = await prisma.fileMetadata.findMany({
      where: { filename: { in: filenames } },
    });
    const metaByFilename = new Map(metaRows.map((m) => [m.filename, m]));
    // Who uses each file, by name (#483): a handful of queries for the whole
    // list, never one per file.
    const usagesByUrl = await listFileUsages(filenames.map((f) => `/uploads/${f}`));

    const items = await Promise.all(
      filenames.map(async (filename) => {
        const filePath = path.join(UPLOADS_DIR, filename);
        const stat = await fs.promises.stat(filePath);
        const ext = path.extname(filename).toLowerCase();
        return {
          filename,
          url: `/uploads/${filename}`,
          size: stat.size,
          uploadedAt: stat.mtime.toISOString(),
          isImage: IMAGE_EXTS.includes(ext),
          ext,
          alt: metaByFilename.get(filename)?.alt ?? null,
          // Null for anything uploaded before #378 — there is nothing to
          // recover, and the library falls back to the stored name.
          originalName: metaByFilename.get(filename)?.originalName ?? null,
          usages: usagesByUrl.get(`/uploads/${filename}`) ?? [],
        };
      }),
    );

    items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    const q = request.query;
    if (!q.page) return items;
    return pageFiles(items, {
      page: Number(q.page),
      limit: Number(q.limit) || FILE_PAGE_SIZE,
      type: q.type,
      extensions: q.ext?.split(","),
    });
  });

  // PUT /api/admin/files/:filename/metadata — update metadata for an
  // existing file. Currently only `alt` is editable; the table is designed
  // to grow with caption/credits/etc. without changing this endpoint shape.
  app.put<{
    Params: { filename: string };
    Body: { alt?: string | null };
  }>("/files/:filename/metadata", async (request, reply) => {
    const { filename } = request.params;

    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return reply.code(400).send({ error: "Invalid filename" });
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      await fs.promises.access(filePath);
    } catch {
      return reply.code(404).send({ error: "File not found" });
    }

    const rawAlt = request.body?.alt;
    const trimmed = typeof rawAlt === "string" ? rawAlt.trim() : "";
    const alt = trimmed.length > 0 ? trimmed : null;

    const meta = await prisma.fileMetadata.upsert({
      where: { filename },
      update: { alt },
      create: { filename, alt },
    });

    return { filename: meta.filename, alt: meta.alt };
  });

  // POST /api/admin/files/:filename/generate-alt — generate an alt text
  // suggestion for an image using Gemini. Doesn't persist the result —
  // the admin reviews it in the UI and saves explicitly via PUT /metadata.
  app.post<{ Params: { filename: string } }>(
    "/files/:filename/generate-alt",
    async (request, reply) => {
      const { filename } = request.params;

      if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
        return reply.code(400).send({ error: "Invalid filename" });
      }

      const ext = path.extname(filename).toLowerCase();
      // Vision reads pixels: an SVG is rendered before it is sent (alt-text.ts),
      // which is what most logos are (#504). ICO stays refused — a container of
      // tiny icons, not worth the quota.
      const supportedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
      if (!supportedExts.includes(ext)) {
        return reply.code(415).send({
          error: "unsupported_format",
          message: `Alt-text generation does not support ${ext} files.`,
        });
      }

      const filePath = path.join(UPLOADS_DIR, filename);
      let buffer: Buffer;
      try {
        buffer = await fs.promises.readFile(filePath);
      } catch {
        return reply.code(404).send({ error: "File not found" });
      }

      const mimeByExt: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
      };

      try {
        const result = await generateAltText(buffer, mimeByExt[ext], {
          userId: request.adminUser?.id ?? null,
        });
        return {
          alt: result.alt,
          model: result.model,
          durationMs: result.durationMs,
          tokensUsed: { input: result.inputTokens, output: result.outputTokens },
        };
      } catch (err) {
        if (!(err instanceof TranslationError)) {
          request.log.error({ err, filename }, "Unexpected alt-text generation error");
        }
        return sendTranslationError(reply, err);
      }
    },
  );

  // DELETE /api/admin/files/:filename — delete a file
  app.delete<{ Params: { filename: string } }>(
    "/files/:filename",
    async (request, reply) => {
      const { filename } = request.params;

      // Prevent path traversal
      if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
        return reply.code(400).send({ error: "Invalid filename" });
      }

      // The media library is shared: a file here may be a speaker's photo, a
      // sponsor's frozen logo or the site's own header logo. Deleting it used to
      // always succeed, leaving the referencing column pointing at nothing and
      // the public page showing a broken image — no fallback fires, because
      // photoUrl is still set (#486). The counter already existed for the trash
      // purge; this is the path that never asked it.
      const usages = await listFileReferences(`/uploads/${filename}`);
      if (usages.length > 0) {
        return reply.code(409).send({
          error: `Ce fichier est encore utilisé par ${describeUsages(usages)}. Remplacez-le là où il sert avant de le supprimer.`,
          usages,
        });
      }

      const filePath = path.join(UPLOADS_DIR, filename);

      try {
        await fs.promises.unlink(filePath);
        // Best-effort cleanup of metadata (no-op if no row exists).
        await prisma.fileMetadata.deleteMany({ where: { filename } });
        return { success: true };
      } catch {
        return reply.code(404).send({ error: "File not found" });
      }
    }
  );
}
