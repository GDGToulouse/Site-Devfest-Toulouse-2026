export type SponsorPageStatus = "PRE_ANNOUNCEMENT" | "TEMPORARY" | "OPEN" | "SOLD_OUT";

export interface Edition {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: "PREPARATION" | "ANNOUNCEMENT" | "SEE_YOU_NEXT_YEAR";
  venueName: string | null;
  venueAddress: string | null;
  heroImageUrl: string | null;
  sponsorFormUrl: string | null;
  aftermovieUrl: string | null;
  previousYear: number | null;
  previousAfterMovieUrl: string | null;
  previousGalleryUrl: string | null;
  galleryUrl: string | null;
  archivedSiteUrl: string | null;
  sponsorBrochureUrl: string | null;
  sponsorHeroImageUrl: string | null;
  sponsorPageStatus: SponsorPageStatus;
  sponsorTemporaryFormUrl: string | null;
  isProgramPublished: boolean;
  hasSpeakers: boolean;
  hasSponsors: boolean;
}

export interface EditionSummary {
  id: number;
  year: number;
  status: "PREPARATION" | "ANNOUNCEMENT" | "SEE_YOU_NEXT_YEAR";
  archivedSiteUrl: string | null;
  startDate: string | null;
}

export interface SocialLinks {
  social_linkedin?: string;
  social_youtube?: string;
  social_x?: string;
  social_bluesky?: string;
}

export interface EcosystemPartner {
  name: string;
  url: string;
  isFeatured: boolean;
}

export interface Article {
  id: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string | null;
  excerptEn: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  tags: { id: number; name: string; slug: string }[];
}

export interface TicketTier {
  id: number;
  nameFr: string;
  nameEn: string;
  price: number;
  status: "AVAILABLE" | "SOLD_OUT" | "COMING_SOON";
  externalUrl: string | null;
  sortOrder: number;
}

export interface KeyFigure {
  icon: string;
  value: string;
  labelFr: string;
  labelEn: string;
}

export interface ArticleDetail extends Article {
  contentFr: string;
  contentEn: string;
  // AI-translation transparency. Optional for backward compat with cached
  // responses that pre-date the field; missing means false.
  autoTranslatedFr?: boolean;
  autoTranslatedEn?: boolean;
  translatedAtFr?: string | null;
  translatedAtEn?: string | null;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface ContentPage {
  id: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  updatedAt: string;
}

export interface SponsorPlan {
  id: number;
  nameFr: string;
  nameEn: string;
  subtitleFr: string | null;
  subtitleEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  price: string | null;
  standSize: string | null;
  advantages: { fr: string; en: string }[];
  color: string;
  isFeatured: boolean;
}

export interface EditionDetail {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: "PREPARATION" | "ANNOUNCEMENT" | "SEE_YOU_NEXT_YEAR";
  venueName: string | null;
  venueAddress: string | null;
  heroImageUrl: string | null;
  aftermovieUrl: string | null;
  galleryUrl: string | null;
  archivedSiteUrl: string | null;
  keyFigures: KeyFigure[];
  articles: Article[];
}

export interface CfpSettings {
  isOpen: boolean;
  sessionizeUrl: string | null;
  openDate: string | null;
  closeDate: string | null;
}

export interface ContactCategory {
  id: number;
  nameFr: string;
  nameEn: string;
  slug: string | null;
  // Optional for backward compat with cached responses; missing means public.
  isPublic?: boolean;
}

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  categoryId: number | null;
  message: string;
  website: string; // honeypot
}

export interface PaginatedArticles {
  articles: Article[];
  total: number;
  page: number;
  totalPages: number;
}
