import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma } from "../../lib/prisma.js";
import { generateAltText } from "../../lib/alt-text.js";
import {
  COMPRESSIBLE_MIMES,
  COMPRESS_MAX_WIDTH,
  COMPRESS_QUALITY,
  SVG_MIME,
  UPLOADS_DIR,
} from "../../lib/image-store.js";
import { sanitizeSvg } from "../../lib/svg-sanitize.js";
import { TranslationError, sendTranslationError } from "../../lib/translation/errors.js";

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

    // Generate unique filename: timestamp-random.ext
    const safeExt = ext || ".jpg";
    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
    const destPath = path.join(UPLOADS_DIR, uniqueName);

    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

    // Buffer the upload first so we can either write it as-is, or send it
    // through sharp for compression. We already cap the stream at 20 MB via
    // limits, so memory usage is bounded.
    let buffer = await data.toBuffer();

    if (data.file.truncated) {
      return reply.code(413).send({ error: "File too large (max 20 MB)" });
    }

    // This route writes to disk itself rather than going through
    // storeImageBuffer, so the SVG guard has to be repeated here — an admin
    // account is not a reason to store executable markup under /uploads/ (#346).
    if (data.mimetype === SVG_MIME) {
      const safe = sanitizeSvg(buffer.toString("utf8"));
      if (!safe) {
        return reply.code(400).send({
          error: "Invalid SVG: nothing renderable left once scripts were removed",
        });
      }
      buffer = Buffer.from(safe, "utf8");
    }

    let finalBuffer = buffer;
    let originalSize = buffer.length;
    let originalDimensions: { width: number; height: number } | null = null;
    let finalDimensions: { width: number; height: number } | null = null;
    let wasCompressed = false;

    if (COMPRESSIBLE_MIMES.has(data.mimetype)) {
      try {
        const pipeline = sharp(buffer, { failOn: "none" }).rotate(); // honor EXIF orientation
        const meta = await pipeline.metadata();
        if (meta.width && meta.height) {
          originalDimensions = { width: meta.width, height: meta.height };
        }

        const needsResize = (meta.width ?? 0) > COMPRESS_MAX_WIDTH;
        if (needsResize) {
          pipeline.resize({ width: COMPRESS_MAX_WIDTH, withoutEnlargement: true });
        }

        // Re-encode to the same format with our quality target. PNG keeps PNG
        // (lossless, palette-friendly); JPEG/WebP get the quality knob.
        if (data.mimetype === "image/jpeg") {
          pipeline.jpeg({ quality: COMPRESS_QUALITY, mozjpeg: true });
        } else if (data.mimetype === "image/webp") {
          pipeline.webp({ quality: COMPRESS_QUALITY });
        } else {
          pipeline.png({ compressionLevel: 9 });
        }

        const processed = await pipeline.toBuffer({ resolveWithObject: true });
        // Only swap the buffer if compression actually saved bytes — otherwise
        // we'd inflate small already-optimized images.
        if (needsResize || processed.data.length < buffer.length) {
          finalBuffer = processed.data;
          finalDimensions = { width: processed.info.width, height: processed.info.height };
          wasCompressed = true;
        }
      } catch (err) {
        // Sharp may fail on edge-case files (corrupt, unsupported variant).
        // Fall back to storing the original and log for ops visibility.
        request.log.warn({ err, filename: data.filename }, "Image compression failed, storing original");
      }
    }

    await fs.promises.writeFile(destPath, finalBuffer);
    const stat = await fs.promises.stat(destPath);

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

    return {
      filename: uniqueName,
      originalName: data.filename,
      url: `/uploads/${uniqueName}`,
      size: stat.size,
      mimetype: data.mimetype,
      alt,
      // Compression telemetry — UI uses this to inform the user when their
      // image was downscaled or recompressed.
      compression: wasCompressed
        ? {
            originalSize,
            finalSize: stat.size,
            originalWidth: originalDimensions?.width ?? null,
            originalHeight: originalDimensions?.height ?? null,
            finalWidth: finalDimensions?.width ?? null,
            finalHeight: finalDimensions?.height ?? null,
            resized:
              originalDimensions && finalDimensions
                ? originalDimensions.width !== finalDimensions.width
                : false,
          }
        : null,
    };
  });

  // GET /api/admin/files — list all uploaded files (images and documents)
  app.get("/files", async () => {
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
        };
      }),
    );

    items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return items;
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
      // Vision works best on raster images. SVG / ICO are too constrained
      // (vector / multi-resolution containers) — refuse them upfront so the
      // admin doesn't burn quota for nothing.
      const supportedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
      if (!supportedExts.includes(ext)) {
        return reply.code(415).send({
          error: "unsupported_format",
          message: `Alt-text generation only supports raster images (got ${ext}).`,
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
