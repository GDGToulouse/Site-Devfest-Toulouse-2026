import { isSafeUrl } from "./sanitize.js";

// The organisers' team (#110): what a member carries, and how it is checked on
// the way in. Shared by the admin routes; the public route only reads.

export const TEAM_LINK_FIELDS = ["websiteUrl", "linkedinUrl", "twitterUrl", "githubUrl", "blueskyUrl"] as const;
export type TeamLinkField = (typeof TEAM_LINK_FIELDS)[number];

const NAME_MAX = 100;
const URL_MAX = 2_048;
// The editions a member can be ticked for: a guard well above the number of
// DevFests there will ever be.
const EDITIONS_MAX = 100;

export interface TeamMemberBody {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  githubUrl?: string | null;
  blueskyUrl?: string | null;
  editionIds?: number[];
}

const nullableUrl = { type: ["string", "null"], maxLength: URL_MAX } as const;

export const teamMemberBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["firstName", "lastName"],
  properties: {
    firstName: { type: "string", minLength: 1, maxLength: NAME_MAX },
    lastName: { type: "string", minLength: 1, maxLength: NAME_MAX },
    photoUrl: nullableUrl,
    ...Object.fromEntries(TEAM_LINK_FIELDS.map((f) => [f, nullableUrl])),
    editionIds: { type: "array", maxItems: EDITIONS_MAX, uniqueItems: true, items: { type: "integer", minimum: 1 } },
  },
} as const;

// "" clears a field; anything else is kept trimmed.
function cleaned(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// The field that is not acceptable, or null. A link must be http(s): it ends
// up in an href on a public page. The photo is an upload (/uploads/…) or a URL.
export function teamMemberBodyError(body: TeamMemberBody): string | null {
  if (!body.firstName.trim()) return "firstName";
  if (!body.lastName.trim()) return "lastName";
  for (const field of TEAM_LINK_FIELDS) {
    const value = cleaned(body[field]);
    if (value && !isSafeUrl(value)) return field;
  }
  const photo = cleaned(body.photoUrl);
  if (photo && !photo.startsWith("/uploads/") && !isSafeUrl(photo)) return "photoUrl";
  return null;
}

export function teamMemberData(body: TeamMemberBody) {
  return {
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    photoUrl: cleaned(body.photoUrl),
    ...Object.fromEntries(TEAM_LINK_FIELDS.map((f) => [f, cleaned(body[f])])),
  } as { firstName: string; lastName: string; photoUrl: string | null } & Record<TeamLinkField, string | null>;
}

// Alphabetical by last name, then first name (RG-412), in French collation so
// accents and case do not scatter the list.
const collator = new Intl.Collator("fr", { sensitivity: "base" });
export function byLastName(a: { firstName: string; lastName: string }, b: { firstName: string; lastName: string }) {
  return collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName);
}
