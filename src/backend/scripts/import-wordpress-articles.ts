/**
 * Import published articles from the current WordPress site (devfesttoulouse.fr)
 * into the new backend through its admin REST API.
 *
 * The script talks HTTP only — it does NOT touch Prisma directly — so it can run
 * against any environment (local, beta) that exposes the admin API.
 *
 * Source: WordPress REST API (public, no key needed): {WP_BASE}/wp-json/wp/v2
 * Target: {TARGET_API}/api/admin/articles, authenticated with an ADMIN API key.
 *
 * Mapping decisions:
 *   - FR content is copied into the EN fields with autoTranslatedEn=true
 *     (a human translates later via the existing Gemini button).
 *   - status = PUBLISHED, publishedAt = the original WordPress date.
 *   - "Edition 20XX" categories -> Edition relation (matched by year).
 *   - Other categories (Annonces, CFP, Les coulisses, Sponsoring, CoC) -> Tags.
 *   - "Non classé" is ignored.
 *   - <iframe> embeds (YouTube) are rewritten to clickable <a> links before
 *     sending, because the backend sanitizer strips iframes.
 *   - Idempotent: an article whose slug already exists is skipped (or updated
 *     with --update).
 *
 * Usage (from src/backend):
 *   ADMIN_API_KEY="dft_live_xxx" \
 *   TARGET_API="https://beta.site.devfesttoulouse.fr" \
 *   npx tsx scripts/import-wordpress-articles.ts --dry-run
 *
 * Flags:
 *   --dry-run   Print what would happen, send nothing.
 *   --update    PUT existing articles instead of skipping them.
 *
 * Env:
 *   ADMIN_API_KEY  (required unless --dry-run) Bearer token of an ADMIN account.
 *   TARGET_API     (default http://localhost:4000) base URL of the target API.
 *   WP_BASE        (default https://devfesttoulouse.fr) source WordPress site.
 */

import { normalizeWordpressHtml } from "./lib/normalize-wordpress-html.js";

const WP_BASE = process.env.WP_BASE || "https://devfesttoulouse.fr";
const TARGET_API = process.env.TARGET_API || "http://localhost:4000";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

const isDryRun = process.argv.includes("--dry-run");
const shouldUpdate = process.argv.includes("--update");

const IGNORED_CATEGORY_SLUGS = new Set(["non-classe"]);

// Image mimes the backend upload endpoint accepts (see admin/files.ts). We
// only re-host these; anything else is left as-is (and likely dropped).
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
]);
const MAX_UPLOAD_BYTES = 20_000_000;

// Maps an accepted mime to a file extension, used only to name the multipart
// upload (the server derives the stored filename's extension from it).
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
};

interface WpRendered {
  rendered: string;
}

interface WpPost {
  id: number;
  slug: string;
  date: string;
  status: string;
  title: WpRendered;
  content: WpRendered;
  excerpt: WpRendered;
  categories: number[];
  _embedded?: {
    author?: Array<{ name?: string }>;
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
}

interface WpCategory {
  id: number;
  name: string;
  slug: string;
}

interface TargetTag {
  id: number;
  name: string;
  slug: string;
}

interface TargetEdition {
  id: number;
  year: number;
}

interface ArticlePayload {
  slug: string;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  excerptFr?: string;
  excerptEn?: string;
  imageUrl?: string;
  author?: string;
  publicationStatus: "PUBLISHED";
  publishedAt: string;
  editionIds: number[];
  tagIds: number[];
  autoTranslatedEn: boolean;
}

async function wpFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2${path}`);
  if (!res.ok) {
    throw new Error(`WordPress GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${TARGET_API}/api/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_API_KEY}`,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body: body as T };
}

// WordPress turns text emojis into <img class="emoji"> whose real src is a
// data:-URI placeholder (the true glyph sits in data-orig-src). The backend
// sanitizer strips data: schemes, leaving a src-less <img> that renders as a
// broken image. The alt attribute already holds the Unicode character, so we
// restore it as plain text before the rest of the pipeline runs.
function stripEmojiImages(html: string): string {
  return html.replace(
    /<img\b[^>]*\bclass=["'][^"']*\bemoji\b[^"']*["'][^>]*>/gi,
    (tag) => {
      const alt = tag.match(/\balt=["']([^"']*)["']/i);
      return alt ? alt[1] : "";
    },
  );
}

// Replace YouTube/Vimeo <iframe> embeds with clickable links so the URL
// survives the backend sanitizer (which strips iframes entirely).
function rewriteIframes(html: string): string {
  return html.replace(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/iframe>/gi, (_match, src) => {
    const url = String(src).replace(/^\/\//, "https://");
    return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`;
  });
}

// Matches every <img> tag and captures its src attribute. Shared by the
// collection and replacement passes of rewriteImages.
const IMG_SRC_REGEX = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;

// Dedup cache across the whole run: a remote image URL maps to its local
// /uploads/... URL once re-hosted, or null if it failed (never retried).
const uploadedImages = new Map<string, string | null>();

// Build a filename for the multipart upload. The server names the stored file
// from this extension, so we must preserve a sensible one.
function deriveFilename(remoteUrl: string, mime: string): string {
  let base = "";
  try {
    base = decodeURIComponent(new URL(remoteUrl).pathname.split("/").pop() || "");
  } catch {
    base = "";
  }
  if (base && /\.[a-z0-9]+$/i.test(base)) return base;
  return `image.${MIME_TO_EXT[mime] ?? "bin"}`;
}

// Download a remote image and re-host it through the backend upload endpoint.
// Returns the local /uploads/... URL, or null on any failure (logged, never
// throws — this is a best-effort per-item step in a batch import).
async function uploadRemoteImage(remoteUrl: string): Promise<string | null> {
  if (uploadedImages.has(remoteUrl)) return uploadedImages.get(remoteUrl) ?? null;

  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      console.warn(`  ! image fetch failed (${res.status}): ${remoteUrl}`);
      uploadedImages.set(remoteUrl, null);
      return null;
    }
    const mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      console.warn(`  ! image skipped (mime ${mime || "unknown"}): ${remoteUrl}`);
      uploadedImages.set(remoteUrl, null);
      return null;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_UPLOAD_BYTES) {
      console.warn(`  ! image too large (${bytes.length} bytes): ${remoteUrl}`);
      uploadedImages.set(remoteUrl, null);
      return null;
    }

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), deriveFilename(remoteUrl, mime));
    // Do NOT set Content-Type: fetch adds the multipart boundary itself.
    const upload = await fetch(`${TARGET_API}/api/admin/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_API_KEY}` },
      body: form,
    });
    if (!upload.ok) {
      console.warn(`  ! image upload failed (${upload.status}): ${remoteUrl}`);
      uploadedImages.set(remoteUrl, null);
      return null;
    }
    const { url } = (await upload.json()) as { url: string };
    uploadedImages.set(remoteUrl, url);
    return url;
  } catch (err) {
    console.warn(`  ! image error (${(err as Error).message}): ${remoteUrl}`);
    uploadedImages.set(remoteUrl, null);
    return null;
  }
}

// Re-host every inline <img> whose src is an absolute http(s) URL, rewriting
// the src to the local /uploads/... path. Non-http(s) srcs (relative,
// protocol-relative, data:, already-local) are left untouched. In dry-run we
// only log the candidates and return the HTML unchanged.
async function rewriteImages(html: string): Promise<string> {
  const srcs = new Set<string>();
  for (const match of html.matchAll(IMG_SRC_REGEX)) {
    if (/^https?:\/\//i.test(match[1])) srcs.add(match[1]);
  }
  if (srcs.size === 0) return html;

  if (isDryRun) {
    for (const src of srcs) console.log(`  [dry-run] would re-host inline image ${src}`);
    return html;
  }

  const rewrites = new Map<string, string>();
  for (const src of srcs) {
    const local = await uploadRemoteImage(src);
    if (local) rewrites.set(src, local);
  }
  return html.replace(IMG_SRC_REGEX, (tag, src) => {
    const local = rewrites.get(src);
    return local ? tag.replace(src, local) : tag;
  });
}

// Decode the most common HTML entities WordPress emits in titles/excerpts.
function decodeEntities(text: string): string {
  return text
    .replace(/&#8217;|&#039;|&#39;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// WordPress slugs can be URL-encoded and carry trailing emojis; clean them up.
function cleanSlug(rawSlug: string): string {
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    // keep the raw value if it is not valid percent-encoding
  }
  return slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function parseEditionYear(categorySlug: string): number | null {
  const match = categorySlug.match(/^edition-(\d{4})$/);
  return match ? Number(match[1]) : null;
}

// Ensure a Tag exists on the target for the given WP category name, returning
// its id. Reuses the preloaded map; creates the tag on first encounter.
async function ensureTag(
  category: WpCategory,
  tagsByName: Map<string, number>,
): Promise<number | null> {
  const existing = tagsByName.get(category.name.toLowerCase());
  if (existing) return existing;

  if (isDryRun) {
    console.log(`    [dry-run] would create tag "${category.name}"`);
    return -1;
  }

  const { status, body } = await adminFetch<TargetTag | { error: string }>("/tags", {
    method: "POST",
    body: JSON.stringify({ name: category.name }),
  });

  if (status === 201) {
    const tag = body as TargetTag;
    tagsByName.set(tag.name.toLowerCase(), tag.id);
    console.log(`    created tag "${tag.name}" (#${tag.id})`);
    return tag.id;
  }
  // 409: created concurrently or name/slug collision — refetch to resolve.
  console.warn(`    could not create tag "${category.name}" (status ${status}); skipping tag`);
  return null;
}

async function main() {
  if (!isDryRun && !ADMIN_API_KEY) {
    throw new Error("ADMIN_API_KEY is required (or pass --dry-run).");
  }

  console.log(`Source : ${WP_BASE}`);
  console.log(`Target : ${TARGET_API}${isDryRun ? "  (dry-run)" : ""}`);
  console.log("");

  // 1. Fetch source data.
  const posts = await wpFetch<WpPost[]>("/posts?per_page=100&_embed=1");
  const categories = await wpFetch<WpCategory[]>("/categories?per_page=100&_fields=id,name,slug");
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  console.log(`WordPress: ${posts.length} posts, ${categories.length} categories.`);

  // 2. Preload target state. Editions require an ADMIN key; degrade gracefully.
  const tagsByName = new Map<string, number>();
  const editionsByYear = new Map<number, number>();
  const existingSlugs = new Set<string>();

  if (!isDryRun) {
    const tagsRes = await adminFetch<TargetTag[]>("/tags");
    if (tagsRes.status !== 200) {
      throw new Error(`Could not list target tags (status ${tagsRes.status}). Check ADMIN_API_KEY.`);
    }
    for (const t of tagsRes.body) tagsByName.set(t.name.toLowerCase(), t.id);

    const editionsRes = await adminFetch<TargetEdition[]>("/editions");
    if (editionsRes.status === 200) {
      for (const e of editionsRes.body) editionsByYear.set(e.year, e.id);
    } else {
      console.warn(
        `  Warning: could not list editions (status ${editionsRes.status}). ` +
          `Edition links will be skipped — use an ADMIN key to enable them.`,
      );
    }

    // Page through existing articles to know which slugs are already present.
    let page = 1;
    for (;;) {
      const res = await adminFetch<{ articles: { slug: string }[]; totalPages: number }>(
        `/articles?page=${page}&limit=100`,
      );
      if (res.status !== 200) break;
      for (const a of res.body.articles) existingSlugs.add(a.slug);
      if (page >= res.body.totalPages) break;
      page += 1;
    }
  }

  // 3 + 4. Transform and upsert each post.
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of posts) {
    const slug = cleanSlug(post.slug);
    try {
      if (post.status !== "publish") {
        console.log(`- ${slug}: skipped (status=${post.status})`);
        skipped += 1;
        continue;
      }

      const alreadyExists = existingSlugs.has(slug);
      if (alreadyExists && !shouldUpdate) {
        console.log(`- ${slug}: skipped (already exists)`);
        skipped += 1;
        continue;
      }

      // Categories -> editions + tags.
      const editionIds: number[] = [];
      const tagIds: number[] = [];
      for (const catId of post.categories) {
        const category = categoriesById.get(catId);
        if (!category || IGNORED_CATEGORY_SLUGS.has(category.slug)) continue;

        const year = parseEditionYear(category.slug);
        if (year !== null) {
          const editionId = editionsByYear.get(year);
          if (editionId) editionIds.push(editionId);
          else console.warn(`    edition ${year} not found in target; skipping edition link`);
          continue;
        }

        const tagId = await ensureTag(category, tagsByName);
        if (tagId && tagId > 0) tagIds.push(tagId);
      }

      const titleFr = decodeEntities(stripHtml(post.title.rendered));
      const cleaned = normalizeWordpressHtml(stripEmojiImages(post.content.rendered));
      const contentFr = await rewriteImages(rewriteIframes(cleaned));
      const excerptFr = stripHtml(post.excerpt.rendered) || undefined;
      const author = post._embedded?.author?.[0]?.name || undefined;

      // Re-host the cover image so the frontend (next/image) never points at
      // the old WordPress host. On failure we drop to undefined rather than
      // keeping the external URL, which would crash next/image.
      const rawImageUrl = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || undefined;
      let imageUrl: string | undefined = undefined;
      if (rawImageUrl) {
        if (isDryRun) {
          console.log(`  [dry-run] would download cover ${rawImageUrl}`);
        } else {
          imageUrl = (await uploadRemoteImage(rawImageUrl)) ?? undefined;
        }
      }

      const payload: ArticlePayload = {
        slug,
        titleFr,
        titleEn: titleFr,
        contentFr,
        contentEn: contentFr,
        excerptFr,
        excerptEn: excerptFr,
        imageUrl,
        author,
        publicationStatus: "PUBLISHED",
        publishedAt: post.date,
        editionIds,
        tagIds,
        autoTranslatedEn: true,
      };

      if (isDryRun) {
        console.log(
          `- ${slug}: would ${alreadyExists ? "update" : "create"} ` +
            `(date=${post.date.slice(0, 10)}, editions=[${editionIds}], tags=${tagIds.length}, ` +
            `img=${rawImageUrl ? "yes" : "no"}, author=${author ?? "—"})`,
        );
        alreadyExists ? (updated += 1) : (created += 1);
        continue;
      }

      if (alreadyExists && shouldUpdate) {
        // Resolve the article id from its slug via the admin detail lookup.
        const listRes = await adminFetch<{ articles: { id: number; slug: string }[] }>(
          `/articles?page=1&limit=100&status=PUBLISHED`,
        );
        const match = listRes.body.articles.find((a) => a.slug === slug);
        if (!match) {
          console.warn(`- ${slug}: marked existing but id not found; creating instead`);
        } else {
          const res = await adminFetch(`/articles/${match.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          if (res.status === 200) {
            console.log(`- ${slug}: updated`);
            updated += 1;
          } else {
            console.error(`- ${slug}: update failed (status ${res.status})`, res.body);
            errors += 1;
          }
          continue;
        }
      }

      const res = await adminFetch<{ id: number } | { error: string }>("/articles", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        console.log(`- ${slug}: created (#${(res.body as { id: number }).id})`);
        created += 1;
      } else if (res.status === 409) {
        console.log(`- ${slug}: skipped (slug conflict)`);
        skipped += 1;
      } else {
        console.error(`- ${slug}: create failed (status ${res.status})`, res.body);
        errors += 1;
      }
    } catch (err) {
      console.error(`- ${slug}: error`, err instanceof Error ? err.message : err);
      errors += 1;
    }
  }

  console.log("");
  console.log(`Done. created=${created} updated=${updated} skipped=${skipped} errors=${errors}`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
