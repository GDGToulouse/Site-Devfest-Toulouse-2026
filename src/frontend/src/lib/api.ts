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
  SponsorPlan,
  SponsorPublic,
  SponsorDetail,
  SpeakerPublic,
  SpeakerDetail,
  TalkDetail,
  EditionSpeaker,
  EditionTalk,
  EcosystemPartner,
  CarouselSlide,
} from "./types";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function fetchAPI<T>(path: string, revalidate = 3600): Promise<T | null> {
  const url = `${BACKEND_URL}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
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

export async function getSeoSettings(): Promise<Record<string, string>> {
  return (await fetchAPI<Record<string, string>>("/api/settings/seo")) || {};
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

export async function getSponsorPlans(): Promise<SponsorPlan[]> {
  return (await fetchAPI<SponsorPlan[]>("/api/editions/current/sponsor-plans")) || [];
}

export async function getSponsors(): Promise<SponsorPublic[]> {
  return (await fetchAPI<SponsorPublic[]>("/api/sponsors")) || [];
}

export async function getSponsorBySlug(slug: string): Promise<SponsorDetail | null> {
  return fetchAPI<SponsorDetail>(`/api/sponsors/${slug}`);
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
