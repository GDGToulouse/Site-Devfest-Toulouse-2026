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

export type SponsorLevel = "PLATINUM" | "GOLD" | "SILVER" | "SOUTIEN" | "COMMUNAUTE";

export interface Sponsor {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  level: SponsorLevel;
  websiteUrl: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  socialLinks: Record<string, string>;
  publicationStatus: "DRAFT" | "PUBLISHED";
  editionId: number;
}

// Public list item (lighter than the admin Sponsor).
export interface SponsorPublic {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  level: SponsorLevel;
  websiteUrl: string | null;
}

export interface SponsorSpeakerRef {
  slug: string;
  name: string;
  photoUrl: string | null;
  company: string | null;
}

export interface SponsorDetail {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  level: SponsorLevel;
  websiteUrl: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  socialLinks: Record<string, string>;
  speakers: SponsorSpeakerRef[];
}

// Public speaker list item.
export interface SpeakerPublic {
  id: number;
  slug: string;
  name: string;
  photoUrl: string | null;
  company: string | null;
  isFeatured?: boolean;
}

export interface SpeakerTalkRef {
  slug: string;
  titleFr: string;
  titleEn: string;
  format: string;
}

export interface SpeakerDetail {
  id: number;
  slug: string;
  name: string;
  photoUrl: string | null;
  company: string | null;
  city: string | null;
  bioFr: string | null;
  bioEn: string | null;
  socialLinks: Record<string, string>;
  sponsor: { slug: string; name: string } | null;
  talks: SpeakerTalkRef[];
}

export type TalkFormat = "CONFERENCE" | "QUICKIE" | "KEYNOTE";
export type TalkLevel = "DEBUTANT" | "INTERMEDIAIRE" | "CONFIRME";

// Admin talk/session entity (CRUD).
export interface Talk {
  id: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  format: TalkFormat;
  level: TalkLevel | null;
  language: string;
  room: string | null;
  categoryId: number | null;
  category: { id: number; nameFr: string; color: string } | null;
  speakerIds: number[];
  speakers: { id: number; name: string }[];
  publicationStatus: "DRAFT" | "PUBLISHED";
  editionId: number;
}

// Session category / track.
export interface Category {
  id: number;
  nameFr: string;
  nameEn: string;
  color: string;
  sortOrder: number;
  editionId: number;
}

// Admin speaker entity (CRUD).
export interface Speaker {
  id: number;
  slug: string;
  name: string;
  photoUrl: string | null;
  company: string | null;
  city: string | null;
  bioFr: string | null;
  bioEn: string | null;
  socialLinks: Record<string, string>;
  isFeatured: boolean;
  sponsorId: number | null;
  publicationStatus: "DRAFT" | "PUBLISHED";
  editionId: number;
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
