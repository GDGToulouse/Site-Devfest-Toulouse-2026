// The replay of a talk is a YouTube video (#636): the player facade, its
// thumbnail and the VideoObject all need a YouTube id. Same id rule as the
// frontend's lib/youtube.ts — keep the two in step.
const YOUTUBE_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

/**
 * The canonical watch URL of a YouTube video, or null when the value is not one.
 * The host is checked on the parsed URL: the id pattern alone would match inside
 * any string, `javascript:` included.
 */
export function canonicalYouTubeUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !YOUTUBE_HOSTS.has(url.hostname)) return null;
  const match = `${url.hostname}${url.pathname}${url.search}`.match(YOUTUBE_ID);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}
