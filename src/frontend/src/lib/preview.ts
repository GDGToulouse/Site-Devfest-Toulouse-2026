import { cookies, draftMode } from "next/headers";

import {
  BACKEND_URL,
  BackendUnavailableError,
  getEditionTalkBySlug,
  getSpeakerBySlug,
  getSponsorBySlug,
  getTalkBySlug,
} from "./api";
import type { EditionTalkDetail, SpeakerDetail, SponsorDetail, TalkDetail } from "./types";

// Draft preview (#618). In Next's draft mode, the speaker, talk and sponsor
// pages read their record through the back-office preview routes, which lift
// the publication filters. Only those pages call these: the social cards and
// Open Graph images keep the public getters, so a cached image never shows a
// draft.
//
// The visitor's cookies go along, since the backend decides who may read a
// draft (the team, from the browser). Nothing here is cached: no-store, and
// next.config.ts drops the s-maxage of a page served with the draft cookie.

export async function fetchPreview<T>(path: string): Promise<T | null | "denied"> {
  const cookieHeader = (await cookies()).toString();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/admin/preview${path}`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });
  } catch (cause) {
    console.error(`[preview] ${path} — backend unreachable`, cause);
    throw new BackendUnavailableError(path, null, cause);
  }
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) return "denied";
  if (!res.ok) {
    console.error(`[preview] ${path} — backend answered HTTP ${res.status}`);
    throw new BackendUnavailableError(path, res.status);
  }
  return (await res.json()) as T;
}

/**
 * The record in preview when draft mode is on, the public one otherwise. A
 * draft cookie that outlived its session (signed out, account demoted) gets
 * the public page, as any visitor would — never an error.
 */
async function previewOr<T>(path: string, publicRead: () => Promise<T | null>): Promise<T | null> {
  if (!(await draftMode()).isEnabled) return publicRead();
  const draft = await fetchPreview<T>(path);
  return draft === "denied" ? publicRead() : draft;
}

/** The backend preview path of a record, as the pages and /api/preview build it. */
export const previewPaths = {
  speaker: (slug: string) => `/speakers/${encodeURIComponent(slug)}`,
  sponsor: (slug: string) => `/sponsors/${encodeURIComponent(slug)}`,
  talk: (year: number, slug: string) => `/editions/${year}/talks/${encodeURIComponent(slug)}`,
  // A talk of the featured edition, as /conferences/<slug> shows it (#633).
  featuredTalk: (slug: string) => `/talks/${encodeURIComponent(slug)}`,
};

export function getSpeakerPage(slug: string): Promise<SpeakerDetail | null> {
  return previewOr(previewPaths.speaker(slug), () => getSpeakerBySlug(slug));
}

export function getSponsorPage(slug: string): Promise<SponsorDetail | null> {
  return previewOr(previewPaths.sponsor(slug), () => getSponsorBySlug(slug));
}

export function getTalkPage(slug: string): Promise<TalkDetail | null> {
  return previewOr(previewPaths.featuredTalk(slug), () => getTalkBySlug(slug));
}

export function getEditionTalkPage(year: number, slug: string): Promise<EditionTalkDetail | null> {
  return previewOr(previewPaths.talk(year, slug), () => getEditionTalkBySlug(year, slug));
}
