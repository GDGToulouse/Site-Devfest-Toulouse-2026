import type {
  Edition,
  EditionDetail,
  EditionSummary,
  SocialLinks,
  Article,
  ArticleDetail,
  TicketTier,
  KeyFigure,
  Tag,
  ContentPage,
  CfpSettings,
  ContactCategory,
  PaginatedArticles,
  SponsorTierPublic,
  SponsorPublic,
  SponsorDetail,
  SponsorWithOffers,
  SpeakerPublic,
  SpeakerDetail,
  TalkDetail,
  EditionSpeaker,
  EditionSpeakerDetail,
  EditionTalk,
  EditionTalkDetail,
  Replay,
  ReplayFilters,
  EcosystemPartner,
  CarouselSlide,
} from "./types";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/**
 * Raised when the backend could not answer at all — 5xx, network failure,
 * timeout. Distinct from "the resource does not exist", which stays a `null`.
 *
 * It exists so a page can tell the two apart (#345): both used to collapse into
 * `null`, so an outage rendered `notFound()` and that 404 was cached for an
 * hour by `s-maxage=3600` — on a resource that exists.
 */
export class BackendUnavailableError extends Error {
  constructor(
    readonly path: string,
    readonly status: number | null,
    cause?: unknown,
  ) {
    super(`Backend unavailable for ${path}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "BackendUnavailableError";
    this.cause = cause;
  }
}

/**
 * Fetch from the backend.
 *
 * Returns `null` only when the backend positively answered "not found". Any
 * other failure throws, so the page renders the error boundary — and is not
 * cached — instead of a 404 that would outlive the outage.
 *
 * Every failure is logged server-side: an unexplained empty page used to leave
 * no trace at all, which made two incidents needlessly hard to diagnose.
 *
 * Exception at build time — see `isBuildTime`.
 */

/**
 * `next build` prerenders manifest.ts, sitemap.ts and the static pages with no
 * backend running — that is expected, and each of those already degrades to its
 * own fallback. Throwing there would fail the build, so during that phase a
 * failure keeps the previous behaviour and returns null.
 *
 * `NEXT_PHASE` is set by Next itself: nothing to configure in CI or Docker.
 */
const isBuildTime = () => process.env.NEXT_PHASE === "phase-production-build";

async function fetchAPI<T>(path: string, revalidate = 3600): Promise<T | null> {
  const url = `${BACKEND_URL}${path}`;
  let res: Response;

  try {
    res = await fetch(url, { next: { revalidate } });
  } catch (cause) {
    console.error(`[api] ${path} — backend unreachable`, cause);
    if (isBuildTime()) return null;
    throw new BackendUnavailableError(path, null, cause);
  }

  if (res.status === 404) return null;

  if (!res.ok) {
    console.error(`[api] ${path} — backend answered HTTP ${res.status}`);
    if (isBuildTime()) return null;
    throw new BackendUnavailableError(path, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch (cause) {
    // A 200 that is not JSON means something is answering in the backend's
    // place — a proxy error page, a misrouted request. Not a missing resource.
    console.error(`[api] ${path} — malformed JSON in a ${res.status} response`, cause);
    if (isBuildTime()) return null;
    throw new BackendUnavailableError(path, res.status, cause);
  }
}

export async function getCurrentEdition(): Promise<Edition | null> {
  return fetchAPI<Edition>("/api/editions/current");
}

export async function getEditions(): Promise<EditionSummary[]> {
  return (await fetchAPI<EditionSummary[]>("/api/editions")) || [];
}

export async function getEditionByYear(year: number): Promise<EditionDetail | null> {
  return fetchAPI<EditionDetail>(`/api/editions/${year}`);
}

export async function getLatestArticles(limit = 4, editionId?: number): Promise<Article[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (editionId) params.set("editionId", String(editionId));
  return (await fetchAPI<Article[]>(`/api/articles/latest?${params}`)) || [];
}

export async function getCurrentTicketTiers(): Promise<TicketTier[]> {
  return (await fetchAPI<TicketTier[]>("/api/editions/current/ticket-tiers")) || [];
}

export async function getKeyFigures(): Promise<KeyFigure[]> {
  return (await fetchAPI<KeyFigure[]>("/api/settings/key-figures")) || [];
}

export async function getArticles(
  page = 1,
  limit = 12,
  tag?: string,
  editionId?: number,
): Promise<PaginatedArticles> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (tag) params.set("tag", tag);
  if (editionId) params.set("editionId", String(editionId));
  return (
    (await fetchAPI<PaginatedArticles>(`/api/articles?${params}`)) || {
      articles: [],
      total: 0,
      page: 1,
      totalPages: 0,
    }
  );
}

export async function getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  return fetchAPI<ArticleDetail>(`/api/articles/${encodeURIComponent(slug)}`);
}

export async function getTags(): Promise<Tag[]> {
  return (await fetchAPI<Tag[]>("/api/tags")) || [];
}

export async function getContentPage(slug: string): Promise<ContentPage | null> {
  return fetchAPI<ContentPage>(`/api/pages/${encodeURIComponent(slug)}`);
}

export async function getCfpSettings(): Promise<CfpSettings> {
  // Short TTL: the close-date check expires the CTA on its own once the
  // date passes. With the default 1h TTL we'd keep showing the button up
  // to an hour past closing. 60s is a fine compromise — admins still get
  // an explicit revalidate when they save in the back-office.
  return (
    (await fetchAPI<CfpSettings>("/api/settings/cfp", 60)) || {
      isOpen: false,
      sessionizeUrl: null,
      openDate: null,
      closeDate: null,
    }
  );
}

export async function getContactCategories(): Promise<ContactCategory[]> {
  return (await fetchAPI<ContactCategory[]>("/api/contact/categories")) || [];
}

export async function getSocialLinks(): Promise<SocialLinks> {
  return (await fetchAPI<SocialLinks>("/api/settings/social")) || {};
}

// Short TTL: the OG image is read both by the layout (twitter:image) and by the
// opengraph-image route (#183). With the default 1h TTL, changing it in the
// admin left the old image in the social previews for up to an hour.
export async function getSeoSettings(): Promise<Record<string, string>> {
  return (await fetchAPI<Record<string, string>>("/api/settings/seo", 60)) || {};
}

// Brand identity (logo variants + favicons). Layout uses these to wire the
// favicon metadata; Header/Footer pick the right logo variant via a helper.
export async function getIdentitySettings(): Promise<Record<string, string>> {
  return (await fetchAPI<Record<string, string>>("/api/settings/identity")) || {};
}

export async function getEcosystemPartners(): Promise<EcosystemPartner[]> {
  return (await fetchAPI<EcosystemPartner[]>("/api/settings/ecosystem")) || [];
}

export async function getAboutCarousel(): Promise<CarouselSlide[]> {
  return (await fetchAPI<CarouselSlide[]>("/api/settings/carousel")) || [];
}

export async function getSponsorTiers(): Promise<SponsorTierPublic[]> {
  return (await fetchAPI<SponsorTierPublic[]>("/api/editions/current/sponsor-tiers")) || [];
}

export async function getSponsors(): Promise<SponsorPublic[]> {
  return (await fetchAPI<SponsorPublic[]>("/api/sponsors")) || [];
}

export async function getSponsorBySlug(slug: string): Promise<SponsorDetail | null> {
  return fetchAPI<SponsorDetail>(`/api/sponsors/${slug}`);
}

export async function getJobOffers(): Promise<SponsorWithOffers[]> {
  return (await fetchAPI<SponsorWithOffers[]>("/api/job-offers")) || [];
}

export async function getSpeakers(): Promise<SpeakerPublic[]> {
  return (await fetchAPI<SpeakerPublic[]>("/api/speakers")) || [];
}

export async function getFeaturedSpeakers(): Promise<SpeakerPublic[]> {
  return (await fetchAPI<SpeakerPublic[]>("/api/speakers/featured")) || [];
}

export async function getSpeakerBySlug(slug: string): Promise<SpeakerDetail | null> {
  return fetchAPI<SpeakerDetail>(`/api/speakers/${slug}`);
}

export async function getTalkBySlug(slug: string): Promise<TalkDetail | null> {
  return fetchAPI<TalkDetail>(`/api/talks/${slug}`);
}

// Past-edition history (issue #63): speakers/talks of a given year, regardless
// of which edition is currently featured.
export async function getEditionSpeakers(year: number): Promise<EditionSpeaker[]> {
  return (await fetchAPI<EditionSpeaker[]>(`/api/editions/${year}/speakers`)) || [];
}

export async function getEditionTalks(year: number): Promise<EditionTalk[]> {
  return (await fetchAPI<EditionTalk[]>(`/api/editions/${year}/talks`)) || [];
}

// Detail of one past speaker (#103), year-scoped for the same reason.
export async function getEditionSpeakerBySlug(
  year: number,
  slug: string,
): Promise<EditionSpeakerDetail | null> {
  return fetchAPI<EditionSpeakerDetail>(`/api/editions/${year}/speakers/${slug}`);
}

// Detail of one past talk (#343). Scoped by year: slugs are unique per edition,
// and `/api/talks/:slug` would answer 404 outside the featured one.
export async function getEditionTalkBySlug(
  year: number,
  slug: string,
): Promise<EditionTalkDetail | null> {
  return fetchAPI<EditionTalkDetail>(`/api/editions/${year}/talks/${slug}`);
}

// Hall of replays (#102). Search and filters are applied server-side so the page
// stays SSR and indexable, instead of shipping the whole catalogue to filter it
// in the browser.
export async function getReplays(params: {
  q?: string;
  year?: string;
  format?: string;
  category?: string;
} = {}): Promise<Replay[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString() ? `?${query}` : "";
  return (await fetchAPI<Replay[]>(`/api/replays${suffix}`)) || [];
}

export async function getReplayFilters(): Promise<ReplayFilters> {
  return (
    (await fetchAPI<ReplayFilters>("/api/replays/filters")) || {
      years: [],
      formats: [],
      categories: [],
      total: 0,
    }
  );
}
