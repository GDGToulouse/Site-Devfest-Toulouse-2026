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
  limit = 9,
  tag?: string,
): Promise<PaginatedArticles> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (tag) params.set("tag", tag);
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

export async function getSponsorPlans(): Promise<SponsorPlan[]> {
  return (await fetchAPI<SponsorPlan[]>("/api/editions/current/sponsor-plans")) || [];
}
