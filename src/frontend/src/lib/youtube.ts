// The 11-character id of a YouTube video, from a watch, short or embed URL;
// null when the URL is none of those. Shared by the player facade and the
// VideoObject structured data (#382).
export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
