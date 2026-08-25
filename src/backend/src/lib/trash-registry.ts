import { prisma } from "./prisma.js";

/**
 * What the trash knows about each soft-deletable entity (#148).
 *
 * Thirteen entities × three operations (list / restore / purge) is thirty-nine
 * routes if written by hand. They only differ by four things — the Prisma
 * delegate, which field labels a row in the UI, which unique fields were parked
 * on the way in, and which fields hold uploaded files — so those differences
 * live here and the routes stay generic.
 */

export interface TrashEntity {
  /** URL segment: /api/admin/trash/<key>. */
  key: string;
  /** Prisma model name, used to reach the delegate. */
  model: string;
  /** Field shown to identify the row in the trash list. */
  labelField: string;
  /** Unique fields parked on soft delete — unparked on restore (#146). */
  parkedFields: readonly string[];
  /** Fields holding an /uploads/ path, checked before purging a file. */
  fileFields: readonly string[];
  /** ADMIN-only entities; the rest follow the ADMIN+EDITOR rule. */
  adminOnly: boolean;
}

export const TRASH_ENTITIES: readonly TrashEntity[] = [
  {
    key: "articles",
    model: "article",
    labelField: "titleFr",
    parkedFields: ["slug"],
    fileFields: ["imageUrl"],
    adminOnly: false,
  },
  {
    key: "tags",
    model: "tag",
    labelField: "name",
    // Both are @unique on Tag, so both are parked and both must come back.
    parkedFields: ["name", "slug"],
    fileFields: [],
    adminOnly: false,
  },
  {
    key: "speakers",
    model: "speaker",
    labelField: "name",
    parkedFields: ["slug"],
    fileFields: ["photoUrl"],
    adminOnly: false,
  },
  {
    key: "talks",
    model: "talk",
    labelField: "title",
    parkedFields: ["slug"],
    fileFields: [],
    adminOnly: false,
  },
  {
    key: "sponsors",
    model: "sponsor",
    labelField: "name",
    parkedFields: ["slug"],
    fileFields: ["logoUrl"],
    adminOnly: false,
  },
  {
    key: "categories",
    model: "category",
    labelField: "nameFr",
    // nameFr became globally unique with shared categories (#338), so a trashed
    // track keeps holding its name unless it is parked on the way out.
    parkedFields: ["nameFr"],
    fileFields: [],
    adminOnly: false,
  },
  {
    key: "ticket-tiers",
    model: "ticketTier",
    labelField: "nameFr",
    // sortOrder is unique per edition but numeric — it cannot be parked under a
    // string prefix, so it kept its slot while trashed (#147). Restoring is
    // therefore safe; creating a new tier at that exact slot is what fails.
    parkedFields: [],
    fileFields: [],
    adminOnly: true,
  },
  {
    key: "sponsor-tiers",
    model: "sponsorTier",
    labelField: "nameFr",
    // `key` is @unique — park it while trashed so a new tier can reuse it (#317).
    parkedFields: ["key"],
    fileFields: [],
    adminOnly: true,
  },
  {
    key: "contact-categories",
    model: "contactCategory",
    labelField: "nameFr",
    parkedFields: ["slug"],
    fileFields: [],
    adminOnly: false,
  },
  {
    key: "contact-messages",
    model: "contactMessage",
    labelField: "email",
    parkedFields: [],
    fileFields: [],
    adminOnly: false,
  },
  {
    key: "editions",
    model: "edition",
    labelField: "year",
    // `year` is unique but numeric — same limitation as ticket sortOrder.
    parkedFields: [],
    fileFields: ["heroImageUrl", "sponsorHeroImageUrl", "sponsorBrochureUrl", "sponsorBrochureUrlEn"],
    adminOnly: true,
  },
  {
    key: "users",
    model: "user",
    labelField: "email",
    parkedFields: ["email"],
    fileFields: [],
    adminOnly: true,
  },
  {
    key: "pages",
    model: "contentPage",
    labelField: "titleFr",
    parkedFields: ["slug"],
    fileFields: [],
    adminOnly: false,
  },
];

export function findTrashEntity(key: string): TrashEntity | undefined {
  return TRASH_ENTITIES.find((e) => e.key === key);
}

/** Reach a Prisma delegate by model name, without `any` leaking into callers. */
type Delegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
  delete: (args: unknown) => Promise<Record<string, unknown>>;
  count: (args: unknown) => Promise<number>;
};

export function delegateFor(entity: TrashEntity): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[entity.model];
}
