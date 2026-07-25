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
    const existingSpeakers = await prisma.speaker.findMany({
      where: { editionId: edition.id },
      select: { id: true, slug: true },
    });
    const takenSpeakerSlugs = new Set(existingSpeakers.map((s) => s.slug));
    const speakerSlugToId = new Map(existingSpeakers.map((s) => [s.slug, s.id]));
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
      const photoUrl = normalizePhotoUrl(sp.photoUrl);
      const bioFr = sp.bio?.trim() || null;

      const existingId = speakerSlugToId.get(baseSlug);
      if (existingId) {
        await prisma.speaker.update({
          where: { id: existingId },
          data: {
            name,
            company: sp.company?.trim() || null,
            city: sp.city?.trim() || null,
            bioFr,
            photoUrl,
            socialLinks: Object.keys(social).length ? JSON.stringify(social) : null,
            publicationStatus: "PUBLISHED",
          },
        });
        idByName.set(name.toLowerCase(), existingId);
        report.speakers.updated++;
      } else {
        const slug = uniqueSlug(baseSlug, takenSpeakerSlugs);
        takenSpeakerSlugs.add(slug);
        const created = await prisma.speaker.create({
          data: {
            editionId: edition.id,
            slug,
            name,
            company: sp.company?.trim() || null,
            city: sp.city?.trim() || null,
            bioFr,
            photoUrl,
            socialLinks: Object.keys(social).length ? JSON.stringify(social) : null,
            publicationStatus: "PUBLISHED",
          },
        });
        speakerSlugToId.set(slug, created.id);
        idByName.set(name.toLowerCase(), created.id);
        report.speakers.created++;
      }
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
        `talks +${report.talks.created}/~${report.talks.updated}`,
    );
  }

  for (const name of [...missingCategories].sort()) {
    report.warnings.push(
      `Catégorie « ${name} » absente du catalogue : les talks concernés restent sans catégorie.`,
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
