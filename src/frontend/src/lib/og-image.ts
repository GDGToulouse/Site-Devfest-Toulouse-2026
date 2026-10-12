const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

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
