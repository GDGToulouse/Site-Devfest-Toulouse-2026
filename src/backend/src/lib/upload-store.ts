import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import type { FastifyBaseLogger } from "fastify";

import { COMPRESSIBLE_MIMES, COMPRESS_MAX_WIDTH, COMPRESS_QUALITY, SVG_MIME, UPLOADS_DIR, UnsafeSvgError } from "./image-store.js";
import { sanitizeSvg } from "./svg-sanitize.js";

// What the media library writes for one file, from an upload or an import by
// URL (#617): the two must land on disk the same way, SVG sanitising (#346)
// and compression included, so they share this rather than each its copy.

export interface StoredUpload {
  filename: string;
  size: number;
  // Compression telemetry: the UI tells the editor when the image was
  // downscaled or recompressed. Null when the file was stored as received.
  compression: {
    originalSize: number;
    finalSize: number;
    originalWidth: number | null;
    originalHeight: number | null;
    finalWidth: number | null;
    finalHeight: number | null;
    resized: boolean;
  } | null;
}

/**
 * Write a file to the media library. Throws UnsafeSvgError when an SVG has
 * nothing renderable left once scripts are stripped: an admin account is not a
 * reason to store executable markup under /uploads/ (#346).
 */
export async function storeUpload(
  input: Buffer,
  mimetype: string,
  ext: string,
  log: FastifyBaseLogger,
): Promise<StoredUpload> {
  let buffer = input;
  if (mimetype === SVG_MIME) {
    const safe = sanitizeSvg(buffer.toString("utf8"));
    if (!safe) throw new UnsafeSvgError();
    buffer = Buffer.from(safe, "utf8");
  }

  let finalBuffer = buffer;
  let originalDimensions: { width: number; height: number } | null = null;
  let finalDimensions: { width: number; height: number } | null = null;
  let wasCompressed = false;

  if (COMPRESSIBLE_MIMES.has(mimetype)) {
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
      if (mimetype === "image/jpeg") {
        pipeline.jpeg({ quality: COMPRESS_QUALITY, mozjpeg: true });
      } else if (mimetype === "image/webp") {
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
      log.warn({ err, mimetype }, "Image compression failed, storing original");
    }
  }

  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  const destPath = path.join(UPLOADS_DIR, filename);
  await fs.promises.writeFile(destPath, finalBuffer);
  const { size } = await fs.promises.stat(destPath);

  return {
    filename,
    size,
    compression: wasCompressed
      ? {
          originalSize: buffer.length,
          finalSize: size,
          originalWidth: originalDimensions?.width ?? null,
          originalHeight: originalDimensions?.height ?? null,
          finalWidth: finalDimensions?.width ?? null,
          finalHeight: finalDimensions?.height ?? null,
          resized: originalDimensions && finalDimensions ? originalDimensions.width !== finalDimensions.width : false,
        }
      : null,
  };
}
