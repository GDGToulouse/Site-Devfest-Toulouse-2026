// A path on this site taken from the address bar (a `next` parameter), or the
// fallback. Resolved as the browser will resolve it, then held to this origin:
// a prefix check reads `/\evil.example` as a path, and the browser leaves for
// `//evil.example` (#658).
const BASE = "https://site.invalid";

export function localPath(raw: string, fallback: string): string {
  if (!raw.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
