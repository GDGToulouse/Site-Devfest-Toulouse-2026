// Normalization helpers for importing data/devfest-history.json into the
// Speaker/Talk models (issue #63). The historical JSON has inconsistent shapes
// across editions (old 2016-2019 vs WordPress 2023-2025), so everything funnels
// through these pure mappers before hitting the database.

export interface HistorySocial {
  // Modern shape (2023+): { type, url }. Old shape (2016-2019): { name|icon, link }.
  type?: string;
  url?: string;
  name?: string;
  icon?: string;
  link?: string;
}

export interface HistorySpeaker {
  name: string;
  company?: string;
  city?: string;
  bio?: string;
  photoUrl?: string;
  socials?: HistorySocial[];
}

export interface HistorySession {
  title: string;
  description?: string;
  speakers?: string[];
  language?: string;
  format?: string;
  complexity?: string;
  tags?: string[];
  youtube?: string;
}

export interface HistoryEdition {
  date?: string;
  venue?: string;
  speakers: HistorySpeaker[];
  sessions: HistorySession[];
}

export interface HistoryData {
  editions: Record<string, HistoryEdition>;
}

// Map a single social entry (either shape) to a [key, url] pair, or null.
export function normalizeSocial(s: HistorySocial): [string, string] | null {
  const url = (s.url || s.link || "").trim();
  if (!url) return null;
  const hint = `${s.type || ""} ${s.name || ""} ${s.icon || ""}`.toLowerCase();
  const u = url.toLowerCase();

  if (hint.includes("twitter") || u.includes("twitter.com") || u.includes("x.com")) return ["twitter", url];
  if (hint.includes("github") || u.includes("github.com")) return ["github", url];
  if (hint.includes("linkedin") || u.includes("linkedin.com")) return ["linkedin", url];
  if (u.includes("bsky.app") || hint.includes("bluesky")) return ["bluesky", url];
  // Everything else (blog, personal site, "website") becomes the website link.
  return ["website", url];
}

// Build the socialLinks JSON object from a list of history socials.
export function buildSocialLinks(socials: HistorySocial[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of socials ?? []) {
    const pair = normalizeSocial(s);
    if (pair && !out[pair[0]]) out[pair[0]] = pair[1];
  }
  return out;
}

export function normalizeFormat(format: string | undefined): "CONFERENCE" | "QUICKIE" | "KEYNOTE" {
  switch ((format || "").toLowerCase()) {
    case "keynote":
      return "KEYNOTE";
    case "quickie":
      return "QUICKIE";
    default:
      return "CONFERENCE";
  }
}

export function normalizeLevel(complexity: string | undefined): "DEBUTANT" | "INTERMEDIAIRE" | "CONFIRME" | null {
  const c = (complexity || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (c.includes("debutant")) return "DEBUTANT";
  if (c.includes("intermediaire")) return "INTERMEDIAIRE";
  if (c.includes("confirme")) return "CONFIRME";
  return null;
}

export function normalizeLanguage(language: string | undefined): string {
  const l = (language || "").toLowerCase();
  return l === "en" ? "en" : "fr";
}

// Photos for 2016-2019 reference paths (/images/speakers/...) that are not
// shipped with this repo, so they would 404. Drop them and rely on the initial
// fallback rendered by the speaker pages (documented JSON limitation).
export function normalizePhotoUrl(photoUrl: string | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("/images/")) return null;
  return photoUrl.startsWith("http") ? photoUrl : null;
}
