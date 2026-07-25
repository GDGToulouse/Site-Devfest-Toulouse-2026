import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

import { validateWebhookUrl } from "./webhook-url.js";
import { sanitizeSvg } from "./svg-sanitize.js";

// Single source of truth for where uploaded media lives. Served publicly at
// /uploads/ (see index.ts static route). The container mounts it at /app/uploads;
// UPLOADS_DIR overrides the path when running outside Docker.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";

// Raster images larger than this width (px) are downscaled before storage.
export const COMPRESS_MAX_WIDTH = 2560;
export const COMPRESS_QUALITY = 85;
// Mimetypes we run through sharp. SVG (vector) and ICO (multi-res icon
// container) are intentionally excluded — re-encoding them would lose
// information or fail outright.
export const COMPRESSIBLE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Remote fetches are bounded: a hostile or broken source must not hang the
// import nor exhaust memory.
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REMOTE_IMAGE_SIZE = 10_000_000; // 10 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

export const SVG_MIME = "image/svg+xml";

/** Raised when an SVG carries nothing renderable once stripped of scripts. */
export class UnsafeSvgError extends Error {
  constructor() {
    super("SVG rejected: nothing renderable left after sanitization");
    this.name = "UnsafeSvgError";
  }
}

// Compress a raster image buffer, keeping the original when re-encoding would
// not save bytes. Returns the buffer to persist.
function compress(buffer: Buffer, mimetype: string): Promise<Buffer> {
  if (!COMPRESSIBLE_MIMES.has(mimetype)) return Promise.resolve(buffer);

  return (async () => {
    try {
      const pipeline = sharp(buffer, { failOn: "none" }).rotate(); // honor EXIF orientation
      const meta = await pipeline.metadata();

      const needsResize = (meta.width ?? 0) > COMPRESS_MAX_WIDTH;
      if (needsResize) {
        pipeline.resize({ width: COMPRESS_MAX_WIDTH, withoutEnlargement: true });
      }

      if (mimetype === "image/jpeg") {
        pipeline.jpeg({ quality: COMPRESS_QUALITY, mozjpeg: true });
      } else if (mimetype === "image/webp") {
        pipeline.webp({ quality: COMPRESS_QUALITY });
      } else {
        pipeline.png({ compressionLevel: 9 });
      }

      const processed = await pipeline.toBuffer();
      return needsResize || processed.length < buffer.length ? processed : buffer;
    } catch {
      // Corrupt or unsupported variant — store the original rather than fail.
      return buffer;
    }
  })();
}

// Persist an image buffer under /uploads/ and return its public URL.
export async function storeImageBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  // SVG is XML, not pixels: it can carry scripts, handlers and remote
  // references, and /uploads/ serves it same-origin. Strip all of that before
  // it ever reaches the disk (#346) — both uploaders funnel through here.
  if (mimetype === SVG_MIME) {
    const safe = sanitizeSvg(buffer.toString("utf8"));
    if (!safe) throw new UnsafeSvgError();
    return writeBuffer(Buffer.from(safe, "utf8"), ".svg");
  }

  const finalBuffer = await compress(buffer, mimetype);
  return writeBuffer(finalBuffer, EXT_BY_MIME[mimetype] ?? ".jpg");
}

// Content-addressed by name: a given URL never changes content, which is what
// lets index.ts cache /uploads/ immutably.
async function writeBuffer(buffer: Buffer, ext: string): Promise<string> {
  const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;

  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOADS_DIR, uniqueName), buffer);

  return `/uploads/${uniqueName}`;
}

// Download a remote image and store it locally, returning its /uploads/ URL.
// Throws on any problem (bad status, non-image, oversized, timeout) so callers
// can decide whether to warn and carry on.
export async function fetchAndStoreImage(url: string): Promise<string> {
  // The URL comes from an imported payload (Sessionize speaker photos), so it is
  // attacker-influenced: guard against SSRF before fetching (#306). Less severe
  // than the JSON endpoint — sharp rejects non-images and errors are swallowed
  // by the caller — but it is still a blind internal-port probe otherwise.
  await validateWebhookUrl(url);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "image/*" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error(`not an image (content-type: ${contentType || "none"})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error("empty response");
  if (buffer.length > MAX_REMOTE_IMAGE_SIZE) {
    throw new Error(`too large (${buffer.length} bytes, max ${MAX_REMOTE_IMAGE_SIZE})`);
  }

  // Don't trust Content-Type alone: confirm the bytes really are an image and
  // resolve the true format before storing.
  const format = (await sharp(buffer, { failOn: "none" }).metadata()).format;
  if (!format) throw new Error("unreadable image data");
  const realMime = `image/${format === "jpg" ? "jpeg" : format}`;

  return storeImageBuffer(buffer, realMime);
}
