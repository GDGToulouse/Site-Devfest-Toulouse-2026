import type { Prisma } from "../generated/prisma/client.js";
import { notDeleted } from "./admin-helpers.js";

// The back-office talk list (#573), on the model of the speakers' (#572):
// filters, sort and pagination answered by the API. The filters are the
// questions of the weeks before the event — which sessions are still drafts
// after the Sessionize import, which have no slot or no room yet, which have
// no speaker — and, after it, which still wait for their replay.

export const TALK_SORTS = ["title", "format", "status", "edition", "startsAt"] as const;
export const TALK_FORMATS = ["CONFERENCE", "QUICKIE", "KEYNOTE", "WORKSHOP"] as const;
export type TalkSort = (typeof TALK_SORTS)[number];

export const TALK_PAGE_SIZE = 50;
export const TALK_PAGE_SIZE_MAX = 100;

export interface TalkListFilters {
  search?: string;
  editionId?: number;
  format?: (typeof TALK_FORMATS)[number];
  status?: "PUBLISHED" | "DRAFT";
  categoryId?: number;
  scheduled?: "yes" | "no";
  roomId?: number;
  speakers?: "none";
  video?: "with" | "without";
  speakerEditable?: "yes" | "no";
}

export function talkWhere(f: TalkListFilters): Prisma.TalkWhereInput {
  const and: Prisma.TalkWhereInput[] = [notDeleted];
  const search = f.search?.trim();
  if (search) {
    and.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { speakers: { some: { ...notDeleted, name: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.editionId) and.push({ editionId: f.editionId });
  if (f.format) and.push({ format: f.format });
  if (f.status) and.push({ publicationStatus: f.status });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  // Scheduled means both a time and a room: either alone leaves the session
  // off the grid, or in a column of its own.
  if (f.scheduled === "yes") and.push({ startsAt: { not: null }, roomId: { not: null } });
  if (f.scheduled === "no") and.push({ OR: [{ startsAt: null }, { roomId: null }] });
  // The room it is given in: a session relayed elsewhere (#456) is not listed
  // under the relay rooms.
  if (f.roomId) and.push({ roomId: f.roomId });
  // Speakers in the trash count as none, as on the public pages.
  if (f.speakers === "none") and.push({ speakers: { none: notDeleted } });
  if (f.video === "with") and.push({ videoUrl: { not: null }, NOT: { videoUrl: "" } });
  if (f.video === "without") and.push({ OR: [{ videoUrl: null }, { videoUrl: "" }] });
  if (f.speakerEditable) and.push({ isSpeakerEditable: f.speakerEditable === "yes" });
  return { AND: and };
}

/**
 * The order of the list. Every column is a field of the talk, so the database
 * sorts and pages; sessions without a slot go last whichever the direction,
 * and the title breaks ties so a page never reshuffles between two loads.
 */
export function talkOrderBy(sort: TalkSort, order: "asc" | "desc"): Prisma.TalkOrderByWithRelationInput[] {
  const byTitle: Prisma.TalkOrderByWithRelationInput = { title: "asc" };
  switch (sort) {
    case "format":
      return [{ format: order }, byTitle];
    case "status":
      return [{ publicationStatus: order }, byTitle];
    case "edition":
      return [{ edition: { year: order } }, byTitle];
    case "startsAt":
      return [{ startsAt: { sort: order, nulls: "last" } }, byTitle];
    default:
      return [{ title: order }];
  }
}
