// Import past editions (2016-2025) from data/devfest-history.json into the
// Speaker / Talk / Edition tables (issue #63). Idempotent and re-runnable on any
// instance (local / beta / prod): entities are matched by (editionId, slug), so
// running it twice updates instead of duplicating.
//
// Usage (from src/backend/):
//   pnpm exec tsx prisma/import-history.ts [path-to-history.json]
//   default path: prisma/devfest-history.json (shipped alongside the script so
//   it is present on every deployed instance — local, beta, prod).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { prisma } from "../src/lib/prisma.js";
import { slugify, uniqueSlug } from "../src/lib/slug.js";
import { resolveSpeakerPhoto } from "../src/lib/speaker-photo.js";
import { revalidateAll } from "../src/lib/revalidate.js";
import {
  buildSocialLinks,
  normalizeCategory,
  normalizeFormat,
  normalizeLevel,
  normalizeLanguage,
  normalizePhotoUrl,
  type HistoryData,
} from "../src/lib/history-import.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultPath = resolve(here, "devfest-history.json");
const jsonPath = process.argv[2] ? resolve(process.argv[2]) : defaultPath;

interface Report {
  editions: { created: number; updated: number };
  speakers: { created: number; updated: number };
  talks: { created: number; updated: number };
  links: number;
  categories: { linked: number; unmatched: number };
  photos: { stored: number };
  cachePurged: boolean;
  warnings: string[];
}

/**
 * Resolve a category name to its id in the shared catalogue (#338), and make
 * sure it is offered on this edition — otherwise the talk keeps a category the
 * public filters cannot show.
 *
 * Categories are never created here: the catalogue is curated in the admin, and
 * a typo in the history file should surface as a warning, not as a new track.
 */
async function linkCategory(name: string, editionId: number) {
  const category = await prisma.category.findUnique({ where: { nameFr: name } });
  if (!category) return null;

  await prisma.editionCategory.upsert({
    where: { editionId_categoryId: { editionId, categoryId: category.id } },
    create: { editionId, categoryId: category.id },
    update: {},
  });
  return category.id;
}

async function main() {
  const raw = readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw) as HistoryData;
  if (!data.editions || typeof data.editions !== "object") {
    throw new Error("Invalid history file: missing `editions` object.");
  }

  const report: Report = {
    editions: { created: 0, updated: 0 },
    speakers: { created: 0, updated: 0 },
    talks: { created: 0, updated: 0 },
    links: 0,
    categories: { linked: 0, unmatched: 0 },
    photos: { stored: 0 },
    cachePurged: false,
    warnings: [],
  };

  const missingCategories = new Set<string>();

  for (const [yearStr, ed] of Object.entries(data.editions)) {
    const year = Number(yearStr);
    if (!Number.isInteger(year)) {
      report.warnings.push(`Édition ignorée: année invalide "${yearStr}".`);
      continue;
    }

    // 1. Upsert the Edition. Past editions are completed → SEE_YOU_NEXT_YEAR.
    const startDate = ed.date ? new Date(`${ed.date}T09:00:00.000Z`) : null;
    const existingEdition = await prisma.edition.findUnique({ where: { year } });
    const edition = await prisma.edition.upsert({
      where: { year },
      create: {
        year,
        startDate,
        status: "SEE_YOU_NEXT_YEAR",
        venueName: ed.venue || null,
      },
      update: {
        // Only fill venue/date if missing, to avoid clobbering manually-set data.
        ...(existingEdition?.venueName ? {} : { venueName: ed.venue || null }),
        ...(existingEdition?.startDate ? {} : { startDate }),
      },
    });
    if (existingEdition) report.editions.updated++;
    else report.editions.created++;

    // 2. Upsert speakers, keyed by slug; remember name -> db id for linking.
    // Reconciled across every edition since #351: a speaker is one person. A
    // lookup scoped to this edition would not see someone imported from another
    // year, so uniqueSlug would mint `ada-lovelace-2` and split the identity in
    // two — exactly what this model change removes.
    const existingSpeakers = await prisma.speaker.findMany({
      select: { id: true, slug: true, photoUrl: true },
    });
    const takenSpeakerSlugs = new Set(existingSpeakers.map((s) => s.slug));
    const speakerSlugToId = new Map(existingSpeakers.map((s) => [s.slug, s.id]));
    // Read here so the photo already on file can be checked before downloading:
    // a picture that is already local must never be fetched again (#356).
    const photoUrlBySlug = new Map(existingSpeakers.map((s) => [s.slug, s.photoUrl]));
    const idByName = new Map<string, number>();

    for (const sp of ed.speakers) {
      const name = sp.name?.trim();
      if (!name) {
        report.warnings.push(`${year}: speaker sans nom ignoré.`);
        continue;
      }
      const baseSlug = slugify(name);
      const social = buildSocialLinks(sp.socials);
      report.links += Object.keys(social).length;
      // The history file points at Twitter, Gravatar, company sites… Those hosts
      // rot and they watch our visitors, so the file is pulled into /uploads/
      // (#356). normalizePhotoUrl still drops the 2016-2019 relative paths,
      // which reference images this repo never shipped.
      const remotePhotoUrl = normalizePhotoUrl(sp.photoUrl);
      const photoUrl = await resolveSpeakerPhoto(
        remotePhotoUrl,
        photoUrlBySlug.get(baseSlug) ?? null,
        name,
        report.warnings,
      );
      if (photoUrl && photoUrl !== photoUrlBySlug.get(baseSlug)) report.photos.stored++;
      const bioFr = sp.bio?.trim() || null;

      const company = sp.company?.trim() || null;
      const city = sp.city?.trim() || null;
      const socialLinks = Object.keys(social).length ? JSON.stringify(social) : null;

      let speakerId: number;
      const existingId = speakerSlugToId.get(baseSlug);
      if (existingId) {
        speakerId = existingId;
        // Fill the gaps, never overwrite. Editions are imported oldest first,
        // so a blanket update would let 2016 erase the profile 2025 filled in —
        // and an admin's manual edit along with it.
        const current = await prisma.speaker.findUniqueOrThrow({
          where: { id: existingId },
          select: { company: true, city: true, bioFr: true, photoUrl: true, socialLinks: true },
        });
        await prisma.speaker.update({
          where: { id: existingId },
          data: {
            name,
            ...(current.company ? {} : { company }),
            ...(current.city ? {} : { city }),
            ...(current.bioFr ? {} : { bioFr }),
            ...(current.photoUrl ? {} : { photoUrl }),
            ...(current.socialLinks ? {} : { socialLinks }),
          },
        });
        if (photoUrl) photoUrlBySlug.set(baseSlug, photoUrl);
        idByName.set(name.toLowerCase(), existingId);
        report.speakers.updated++;
      } else {
        const slug = uniqueSlug(baseSlug, takenSpeakerSlugs);
        takenSpeakerSlugs.add(slug);
        const created = await prisma.speaker.create({
          data: { slug, name, company, city, bioFr, photoUrl, socialLinks },
        });
        speakerSlugToId.set(slug, created.id);
        // Keep the photo map in step: the list is re-read per edition, but two
        // entries sharing a name inside the SAME year would otherwise download
        // the picture twice.
        photoUrlBySlug.set(slug, photoUrl);
        idByName.set(name.toLowerCase(), created.id);
        speakerId = created.id;
        report.speakers.created++;
      }

      // The participation is what carries the year (#351). It must be recorded
      // even for a speaker with no session at all: 31 of them have none, and
      // their editions cannot be derived from talks.
      await prisma.speakerEdition.upsert({
        where: { speakerId_editionId: { speakerId, editionId: edition.id } },
        create: { speakerId, editionId: edition.id, publicationStatus: "PUBLISHED" },
        update: { publicationStatus: "PUBLISHED" },
      });
    }

    // 3. Upsert sessions (talks), keyed by slug, linking speakers by name.
    const existingTalks = await prisma.talk.findMany({
      where: { editionId: edition.id },
      select: { id: true, slug: true },
    });
    const takenTalkSlugs = new Set(existingTalks.map((t) => t.slug));
    const talkSlugToId = new Map(existingTalks.map((t) => [t.slug, t.id]));

    for (const s of ed.sessions) {
      const title = s.title?.trim();
      if (!title) {
        report.warnings.push(`${year}: session sans titre ignorée.`);
        continue;
      }
      const baseSlug = slugify(title);
      const description = s.description?.trim() ?? "";
      const speakerDbIds = (s.speakers ?? [])
        .map((n) => idByName.get(n.trim().toLowerCase()))
        .filter((id): id is number => id !== undefined);

      // Track published by the edition itself, mapped onto the shared catalogue.
      const categoryName = normalizeCategory(s);
      let categoryId: number | null = null;
      if (categoryName) {
        categoryId = await linkCategory(categoryName, edition.id);
        if (categoryId) report.categories.linked++;
        else {
          report.categories.unmatched++;
          // One line per missing category, not per talk: on an instance without
          // the catalogue that would be 279 identical warnings burying the rest.
          missingCategories.add(categoryName);
        }
      }

      const talkData = {
        title,
        description,
        format: normalizeFormat(s.format),
        level: normalizeLevel(s.complexity),
        language: normalizeLanguage(s.language),
        videoUrl: s.youtube?.trim() || null,
        categoryId,
        publicationStatus: "PUBLISHED" as const,
      };

      const existingId = talkSlugToId.get(baseSlug);
      if (existingId) {
        // Never blank out a category set in the admin: on a re-run the file may
        // have nothing to say about a talk that was curated by hand since.
        const { categoryId: _, ...rest } = talkData;
        await prisma.talk.update({
          where: { id: existingId },
          data: {
            ...rest,
            ...(categoryId ? { categoryId } : {}),
            speakers: { set: speakerDbIds.map((id) => ({ id })) },
          },
        });
        report.talks.updated++;
      } else {
        const slug = uniqueSlug(baseSlug, takenTalkSlugs);
        takenTalkSlugs.add(slug);
        await prisma.talk.create({
          data: {
            editionId: edition.id,
            slug,
            ...talkData,
            speakers: { connect: speakerDbIds.map((id) => ({ id })) },
          },
        });
        report.talks.created++;
      }
    }

    console.log(
      `${year}: speakers +${report.speakers.created}/~${report.speakers.updated}, ` +
        `talks +${report.talks.created}/~${report.talks.updated}, ` +
        `photos ${report.photos.stored}`,
    );
  }

  for (const name of [...missingCategories].sort()) {
    report.warnings.push(
      `Catégorie « ${name} » absente du catalogue : les talks concernés restent sans catégorie.`,
    );
  }

  // The data is in, but every public page still serves what it cached before
  // this run — for up to an hour (#358). Admin mutations revalidate as they go;
  // a CLI script has to do it itself.
  //
  // A failure here is never fatal: the import succeeded in the database, and
  // saying otherwise would invite a needless re-run. It is loud instead, because
  // nothing else will tell the operator the site is showing stale pages.
  const purge = await revalidateAll();
  report.cachePurged = purge.ok;
  if (!purge.ok) {
    report.warnings.push(
      `Cache non purgé (${purge.reason}) : les pages publiques serviront l'état précédent ` +
        `jusqu'à expiration du cache. Purger depuis l'admin, ou redémarrer le frontend.`,
    );
  }

  console.log("\n=== Import history report ===");
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Import failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
