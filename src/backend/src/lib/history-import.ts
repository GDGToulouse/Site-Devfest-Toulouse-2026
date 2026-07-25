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
  // Track as published by the edition itself. 2016-2019 expose it through
  // `tags`; 2023-2025 carry it here, recovered from the archived sites.
  category?: string;
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

// Editions named their tracks differently every year — three spelling
// generations in the 2016-2019 `tags`, then the WordPress terms of 2023-2025.
// They all funnel into the shared catalogue introduced by #338 so a category
// spans editions instead of being recreated each year.
const CATEGORY_BY_TAG: Record<string, string> = {
  // 2016-2019 tags
  web: "Front-end / UX / Accessibilité",
  _web: "Front-end / UX / Accessibilité",
  mobile: "Applications mobiles",
  "native mobile apps": "Applications mobiles",
  _native_mobile_apps: "Applications mobiles",
  cloud: "Infra / DevOps / Sécurité",
  _cloud___infra: "Infra / DevOps / Sécurité",
  languages: "Langages de programmation",
  langages: "Langages de programmation",
  _languages: "Langages de programmation",
  "methods & tools": "Méthodes et outils de développement",
  "method & tools": "Méthodes et outils de développement",
  "méthodes et outils": "Méthodes et outils de développement",
  _method___tools: "Méthodes et outils de développement",
  ia: "IA / Machine Learning / Data",
  data: "IA / Machine Learning / Data",
  "machine learning": "IA / Machine Learning / Data",
  "big data / ml / ai": "IA / Machine Learning / Data",
  _big_data___ml___ai: "IA / Machine Learning / Data",
  iot: "Internet des objets / Systèmes embarqués",
  _iot: "Internet des objets / Systèmes embarqués",
  wtf: "Tech créative / Autres sujets",
  _wtf: "Tech créative / Autres sujets",
  general: "Tech créative / Autres sujets",
  keynote: "Tech créative / Autres sujets",

  // 2023-2025 WordPress terms
  "wtf / autre": "Tech créative / Autres sujets",
  "ux / accessibilité": "Front-end / UX / Accessibilité",
  "cloud / infra / ops": "Infra / DevOps / Sécurité",
  "cloud / infra / {dev, git, sec}ops": "Infra / DevOps / Sécurité",
  "cloud / infra / {dev-git-sec}ops": "Infra / DevOps / Sécurité",
  "iot / embarqué": "Internet des objets / Systèmes embarqués",

  // Terms already spelled like the current catalogue
  "applications mobiles": "Applications mobiles",
  "developer experience": "Developer Experience",
  "dev assisté par ia": "Dev assisté par IA",
  "front-end / ux / accessibilité": "Front-end / UX / Accessibilité",
  "ia / machine learning / data": "IA / Machine Learning / Data",
  "infra / devops / sécurité": "Infra / DevOps / Sécurité",
  "internet des objets / systèmes embarqués": "Internet des objets / Systèmes embarqués",
  "langages de programmation": "Langages de programmation",
  "low code / no code": "Low code / No code",
  "méthodes et outils de développement": "Méthodes et outils de développement",
  "tech créative / autres sujets": "Tech créative / Autres sujets",
};

/**
 * Resolve a session's track name in the shared catalogue.
 *
 * `category` (2023-2025) wins over `tags` (2016-2019) because it is the term the
 * edition itself published. Returns null when nothing matches — the category is
 * optional on Talk, and inventing one would be worse than leaving it empty.
 */
export function normalizeCategory(session: HistorySession): string | null {
  const candidates = [session.category, ...(session.tags ?? [])];
  for (const raw of candidates) {
    if (!raw) continue;
    const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (CATEGORY_BY_TAG[key]) return CATEGORY_BY_TAG[key];
  }
  return null;
}

// Photos for 2016-2019 reference paths (/images/speakers/...) that are not
// shipped with this repo, so they would 404. Drop them and rely on the initial
// fallback rendered by the speaker pages (documented JSON limitation).
export function normalizePhotoUrl(photoUrl: string | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("/images/")) return null;
  return photoUrl.startsWith("http") ? photoUrl : null;
}
