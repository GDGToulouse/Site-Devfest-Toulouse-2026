import { readFile } from "node:fs/promises";
import path from "node:path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

// The site's own static images (public/), such as the sponsors' logos shipped
// with the demo data (#116): served by the frontend, unknown to the backend.
const PUBLIC_DIR = path.join(process.cwd(), "public");
const STATIC_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

async function staticDataUri(src: string): Promise<string | null> {
  const file = path.join(PUBLIC_DIR, src);
  const type = STATIC_TYPES[path.extname(file).toLowerCase()];
  // Never outside public/: the path comes from data an editor typed.
  if (!type || !file.startsWith(PUBLIC_DIR + path.sep)) return null;
  try {
    const bytes = await readFile(file);
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

// Ceiling well above any legitimate picture (the admin upload limit is 5 MB):
// an oversized file falls back to the generated card rather than stalling it.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * An image as a data URI, ready for `ImageResponse` (#600).
 *
 * Satori fetches nothing on its own inside the container, and rejects a
 * relative source outright — "Image source must be an absolute URL" — after
 * the response has started, so the proxy answers 502. Uploads are stored as
 * `/uploads/…`: they are read from the backend, which serves them, rather than
 * through the public domain. `null` when the image cannot be had, so the
 * caller draws its fallback instead of failing.
 */
export async function imageDataUri(src: string): Promise<string | null> {
  if (src.startsWith("/") && !src.startsWith("/uploads/")) return staticDataUri(src);
  const url = /^https?:\/\//.test(src) ? src : `${BACKEND_URL}${src}`;
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return null;

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;

    const type = upstream.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
