// A talk and a speaker's participation have their own status (#726), apart
// from the PublicationStatus of articles, the FAQ and sponsors. Besides draft
// and published, a talk can be cancelled and a participation withdrawn: hidden
// from the site like a draft, but never coming back by accident.

export const TALK_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;
export type TalkStatus = (typeof TALK_STATUSES)[number];

export const SPEAKER_EDITION_STATUSES = ["DRAFT", "PUBLISHED", "WITHDRAWN"] as const;
export type SpeakerEditionStatus = (typeof SPEAKER_EDITION_STATUSES)[number];

/**
 * The talks a page shows: the published ones, or in the team's preview (#618)
 * every talk that may still be published. A cancelled talk never will, so the
 * preview leaves it out too.
 */
export function visibleTalk(includeDrafts: boolean) {
  return includeDrafts
    ? { publicationStatus: { not: "CANCELLED" as const } }
    : { publicationStatus: "PUBLISHED" as const };
}

/** Same for a speaker's participation in an edition: a withdrawn one is out. */
export function visibleParticipation(includeDrafts: boolean) {
  return includeDrafts
    ? { publicationStatus: { not: "WITHDRAWN" as const } }
    : { publicationStatus: "PUBLISHED" as const };
}
