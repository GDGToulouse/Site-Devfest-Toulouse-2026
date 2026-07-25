import { fetchAndStoreImage } from "./image-store.js";
import { prisma } from "./prisma.js";
import { slugify, uniqueSlug } from "./slug.js";
import { validateWebhookUrl } from "./webhook-url.js";

// --- Sessionize "All data" JSON shapes (only the fields we consume) ---

export interface SzLink {
  title?: string;
  url: string;
  linkType?: string;
}

interface SzSpeaker {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  bio?: string | null;
  tagLine?: string | null;
  profilePicture?: string | null;
  links?: SzLink[];
  sessions?: Array<number | string>;
}

interface SzCategoryItem {
  id: number;
  name: string;
}

export interface SzCategory {
  id: number;
  title: string;
  type?: string;
  items: SzCategoryItem[];
}

interface SzSession {
  id: string;
  title: string;
  description?: string | null;
  isServiceSession?: boolean;
  speakers?: string[];
  categoryItems?: number[];
  room?: string | null;
}

interface SessionizeData {
  sessions?: SzSession[];
  speakers?: SzSpeaker[];
  categories?: SzCategory[];
}

export interface ImportReport {
  speakers: { created: number; updated: number };
  talks: { created: number; updated: number };
  categories: { created: number; reused: number };
  links: number;
  warnings: string[];
}

// Map a Sessionize link to our socialLinks key. Sessionize sets linkType for
// well-known networks; we fall back to matching the URL host.
export function socialKeyFor(link: SzLink): string | null {
  const type = (link.linkType ?? "").toLowerCase();
  const url = link.url.toLowerCase();
  if (type === "twitter" || url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (type === "linkedin" || url.includes("linkedin.com")) return "linkedin";
  if (type === "github" || url.includes("github.com")) return "github";
  if (url.includes("bsky.app") || url.includes("bluesky")) return "bluesky";
  if (type === "blog" || type === "company_website" || type === "website") return "website";
  return null;
}

export function buildSocialLinks(links: SzLink[] | undefined): { social: Record<string, string>; count: number } {
  const social: Record<string, string> = {};
  let count = 0;
  for (const link of links ?? []) {
    const key = socialKeyFor(link);
    if (key && !social[key]) {
      social[key] = link.url;
      count++;
    }
  }
  // Use the first generic link as the website if none matched explicitly.
  if (!social.website) {
    const generic = (links ?? []).find((l) => !socialKeyFor(l));
    if (generic) {
      social.website = generic.url;
      count++;
    }
  }
  return { social, count };
}

export const FORMAT_KEYWORDS: Array<[RegExp, "CONFERENCE" | "QUICKIE" | "KEYNOTE" | "WORKSHOP"]> = [
  [/keynote/i, "KEYNOTE"],
  [/workshop|atelier|hands ?on|codelab|lab\b/i, "WORKSHOP"],
  [/quick|tool ?in ?action|lightning|éclair|eclair/i, "QUICKIE"],
  [/conf|talk|session/i, "CONFERENCE"],
];

export const LEVEL_KEYWORDS: Array<[RegExp, "DEBUTANT" | "INTERMEDIAIRE" | "CONFIRME"]> = [
  [/beginner|débutant|debutant|introductory|novice/i, "DEBUTANT"],
  [/intermediate|intermédiaire|intermediaire/i, "INTERMEDIAIRE"],
  [/advanced|avancé|avance|expert|confirmé|confirme/i, "CONFIRME"],
];

// Sessionize spells languages out ("Français" / "English"); we only store the
// ISO-639-1 code on the talk.
export const LANGUAGE_KEYWORDS: Array<[RegExp, "fr" | "en"]> = [
  [/français|francais|french|\bfr\b/i, "fr"],
  [/anglais|english|\ben\b/i, "en"],
];

export function matchEnum<T>(name: string, table: Array<[RegExp, T]>): T | null {
  for (const [re, value] of table) {
    if (re.test(name)) return value;
  }
  return null;
}

// Resolve a category definition's role from its Sessionize `type`/`title`.
// "language" must be checked before "level" so "Langue" isn't misread, and
// anything unrecognized falls back to a thematic track.
export function categoryRole(c: SzCategory): "format" | "level" | "language" | "track" {
  const label = `${c.type ?? ""} ${c.title ?? ""}`.toLowerCase();
  if (/format|type|session ?type/.test(label)) return "format";
  if (/langue|language|langage/.test(label)) return "language";
  if (/level|niveau|expérience|experience/.test(label)) return "level";
  return "track";
}

export function isLocalUpload(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/uploads/");
}

// Sessionize serves speaker pictures from its own CDN, which next/image refuses
// to load (host not in remotePatterns) — so we pull the file into /uploads/ and
// store a local URL instead (#205). Re-imports keep an existing local photo
// rather than downloading it again (RG-217 idempotence). A download failure is
// never fatal: the speaker is imported without a photo and a warning is
// reported.
export async function resolveSpeakerPhoto(
  remoteUrl: string | null | undefined,
  currentPhotoUrl: string | null,
  speakerName: string,
  report: ImportReport,
): Promise<string | null> {
  if (isLocalUpload(currentPhotoUrl)) return currentPhotoUrl;
  if (!remoteUrl?.trim()) return null;

  try {
    return await fetchAndStoreImage(remoteUrl.trim());
  } catch (err) {
    report.warnings.push(
      `Photo de ${speakerName} non importée : ${(err as Error).message}.`,
    );
    return null;
  }
}

// Run the idempotent import. Speakers/talks are matched by their slug derived
// from name/title within the edition (RG-206/RG-214); re-importing the same
// data updates existing rows instead of duplicating them (RG-217 idempotence).
export async function importSessionize(
  editionId: number,
  data: SessionizeData,
): Promise<ImportReport> {
  const report: ImportReport = {
    speakers: { created: 0, updated: 0 },
    talks: { created: 0, updated: 0 },
    categories: { created: 0, reused: 0 },
    links: 0,
    warnings: [],
  };

  // 1. Index Sessionize category items by id, classified by role. An item that
  // sits under a format/level/language category but matches no keyword is a
  // silent data loss otherwise — report it so the mapping gap is visible.
  const trackByItemId = new Map<number, string>();
  const formatByItemId = new Map<number, "CONFERENCE" | "QUICKIE" | "KEYNOTE" | "WORKSHOP">();
  const levelByItemId = new Map<number, "DEBUTANT" | "INTERMEDIAIRE" | "CONFIRME">();
  const languageByItemId = new Map<number, "fr" | "en">();

  for (const cat of data.categories ?? []) {
    const role = categoryRole(cat);
    for (const item of cat.items ?? []) {
      switch (role) {
        case "track":
          trackByItemId.set(item.id, item.name);
          break;
        case "format": {
          const f = matchEnum(item.name, FORMAT_KEYWORDS);
          if (f) formatByItemId.set(item.id, f);
          else report.warnings.push(`Format Sessionize non reconnu : « ${item.name} » — talks concernés en CONFERENCE par défaut.`);
          break;
        }
        case "level": {
          const lvl = matchEnum(item.name, LEVEL_KEYWORDS);
          if (lvl) levelByItemId.set(item.id, lvl);
          else report.warnings.push(`Niveau Sessionize non reconnu : « ${item.name} » — talks concernés sans niveau.`);
          break;
        }
        case "language": {
          const lang = matchEnum(item.name, LANGUAGE_KEYWORDS);
          if (lang) languageByItemId.set(item.id, lang);
          else report.warnings.push(`Langue Sessionize non reconnue : « ${item.name} » — talks concernés en fr par défaut.`);
          break;
        }
      }
    }
  }

  // 2. Upsert track categories, keyed by nameFr — globally since #338, not per
  // edition: a track already declared by another year is reused rather than
  // duplicated, and only its binding to this edition is created.
  // Deliberately NOT filtered on deletedAt (#147): these lookups drive upserts,
  // so they must see trashed rows. Skipping them would recreate a category that
  // already exists in the trash and hit the unique index on nameFr.
  const existingCategories = await prisma.category.findMany({
    select: { id: true, nameFr: true },
  });
  const categoryIdByName = new Map(existingCategories.map((c) => [c.nameFr, c.id]));
  const existingLinks = await prisma.editionCategory.findMany({
    where: { editionId },
    select: { categoryId: true },
  });
  const linkedCategoryIds = new Set(existingLinks.map((l) => l.categoryId));
  let sortOrder = existingLinks.length;

  for (const name of new Set(trackByItemId.values())) {
    let categoryId = categoryIdByName.get(name);

    if (categoryId === undefined) {
      const created = await prisma.category.create({
        data: { nameFr: name, nameEn: name, color: "#109E6E" },
      });
      categoryId = created.id;
      categoryIdByName.set(name, categoryId);
      report.categories.created++;
    } else {
      report.categories.reused++;
    }

    // The track may exist globally without this edition proposing it yet.
    if (!linkedCategoryIds.has(categoryId)) {
      await prisma.editionCategory.create({
        data: { editionId, categoryId, sortOrder: sortOrder++ },
      });
      linkedCategoryIds.add(categoryId);
    }
  }

  // 3. Upsert speakers, keyed by slug. Track the resulting db id per Sessionize id.
  const existingSpeakers = await prisma.speaker.findMany({
    where: { editionId },
    select: { id: true, slug: true, photoUrl: true },
  });
  const takenSpeakerSlugs = new Set(existingSpeakers.map((s) => s.slug));
  const speakerSlugToId = new Map(existingSpeakers.map((s) => [s.slug, s.id]));
  const photoUrlBySlug = new Map(existingSpeakers.map((s) => [s.slug, s.photoUrl]));
  const dbIdBySzSpeakerId = new Map<string, number>();

  for (const sz of data.speakers ?? []) {
    const name = sz.fullName?.trim() || `${sz.firstName ?? ""} ${sz.lastName ?? ""}`.trim();
    if (!name) {
      report.warnings.push(`Speaker ${sz.id} ignoré : aucun nom.`);
      continue;
    }
    const baseSlug = slugify(name);
    const { social, count } = buildSocialLinks(sz.links);
    report.links += count;

    const photoUrl = await resolveSpeakerPhoto(
      sz.profilePicture,
      photoUrlBySlug.get(baseSlug) ?? null,
      name,
      report,
    );

    const existingId = speakerSlugToId.get(baseSlug);
    if (existingId) {
      const updated = await prisma.speaker.update({
        where: { id: existingId },
        data: {
          name,
          company: sz.tagLine?.trim() || null,
          bioFr: sz.bio?.trim() || null,
          photoUrl,
          socialLinks: count > 0 ? JSON.stringify(social) : null,
        },
      });
      dbIdBySzSpeakerId.set(sz.id, updated.id);
      report.speakers.updated++;
    } else {
      const slug = uniqueSlug(baseSlug, takenSpeakerSlugs);
      takenSpeakerSlugs.add(slug);
      const created = await prisma.speaker.create({
        data: {
          editionId,
          slug,
          name,
          company: sz.tagLine?.trim() || null,
          bioFr: sz.bio?.trim() || null,
          photoUrl,
          socialLinks: count > 0 ? JSON.stringify(social) : null,
          publicationStatus: "DRAFT",
        },
      });
      speakerSlugToId.set(slug, created.id);
      dbIdBySzSpeakerId.set(sz.id, created.id);
      report.speakers.created++;
    }
  }

  // 4. Upsert sessions (talks), keyed by slug, linking speakers + category.
  const existingTalks = await prisma.talk.findMany({
    where: { editionId },
    select: { id: true, slug: true },
  });
  const takenTalkSlugs = new Set(existingTalks.map((t) => t.slug));
  const talkSlugToId = new Map(existingTalks.map((t) => [t.slug, t.id]));

  for (const sz of data.sessions ?? []) {
    if (sz.isServiceSession) continue; // breaks, lunch, etc.
    const title = sz.title?.trim();
    if (!title) {
      report.warnings.push(`Session ${sz.id} ignorée : aucun titre.`);
      continue;
    }
    const baseSlug = slugify(title);

    const items = sz.categoryItems ?? [];
    const format = items.map((id) => formatByItemId.get(id)).find(Boolean) ?? "CONFERENCE";
    const level = items.map((id) => levelByItemId.get(id)).find(Boolean) ?? null;
    const language = items.map((id) => languageByItemId.get(id)).find(Boolean) ?? "fr";
    const trackName = items.map((id) => trackByItemId.get(id)).find(Boolean);
    const categoryId = trackName ? categoryIdByName.get(trackName) ?? null : null;

    const speakerDbIds = (sz.speakers ?? [])
      .map((szId) => dbIdBySzSpeakerId.get(szId))
      .filter((id): id is number => id !== undefined);

    const description = sz.description?.trim() ?? "";

    const existingId = talkSlugToId.get(baseSlug);
    if (existingId) {
      await prisma.talk.update({
        where: { id: existingId },
        data: {
          title,
          description,
          format,
          level,
          language,
          categoryId,
          speakers: { set: speakerDbIds.map((id) => ({ id })) },
        },
      });
      report.talks.updated++;
    } else {
      const slug = uniqueSlug(baseSlug, takenTalkSlugs);
      takenTalkSlugs.add(slug);
      await prisma.talk.create({
        data: {
          editionId,
          slug,
          title,
          description,
          format,
          level,
          language,
          categoryId,
          publicationStatus: "DRAFT",
          speakers: { connect: speakerDbIds.map((id) => ({ id })) },
        },
      });
      report.talks.created++;
    }
  }

  return report;
}

// Fetch + parse a Sessionize "All data" payload from either a raw JSON string
// or a Sessionize API URL. Validates the shape minimally before importing.
export async function loadSessionizeData(opts: { json?: string; url?: string }): Promise<SessionizeData> {
  let raw: unknown;
  if (opts.json?.trim()) {
    raw = JSON.parse(opts.json);
  } else if (opts.url?.trim()) {
    // The URL comes from a back-office form, so guard it against SSRF before
    // fetching: without this an editor could point it at the cloud metadata
    // endpoint, an internal DB, or another backend on the shared Coolify network
    // (#306). validateWebhookUrl rejects loopback/private/link-local hosts and
    // throws on a bad scheme — same guard the contact webhook already uses.
    await validateWebhookUrl(opts.url.trim());
    const res = await fetch(opts.url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Sessionize fetch failed: HTTP ${res.status}`);
    raw = await res.json();
  } else {
    throw new Error("Provide either `json` or `url`.");
  }

  if (!raw || typeof raw !== "object") throw new Error("Invalid Sessionize payload.");
  const data = raw as SessionizeData;
  if (!Array.isArray(data.sessions) && !Array.isArray(data.speakers)) {
    throw new Error("Payload has no `sessions` or `speakers` array — is this the 'All data' export?");
  }
  return data;
}
