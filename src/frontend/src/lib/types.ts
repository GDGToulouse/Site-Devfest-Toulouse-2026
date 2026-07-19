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
  isScheduleReady: boolean;
  hasSpeakers: boolean;
  hasSponsors: boolean;
  // At least one partner job offer is published and still within its
  // post-event visibility window.
  hasJobOffers: boolean;
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

// Ambiance image for the home "Derrière le DevFest" carousel (#99).
export interface CarouselSlide {
  url: string;
  alt: string;
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
  saleStartDate: string | null;
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
  contactEmail: string | null;
  locale: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
  editionId: number;
  // Private fields (#249) — organizers only, never on public pages.
  standContacts?: { name?: string; linkedin?: string; twitter?: string; bluesky?: string }[];
  comKitReceived?: boolean;
  comKitLogoWebUrl?: string | null;
  comKitLogoPrintUrl?: string | null;
  comKitCharterUrl?: string | null;
  comKitNotes?: string | null;
  platinumPromoIdea?: string | null;
  platinumCoBuildIdea?: string | null;
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

// A job offer a sponsor wants relayed (#251). The description is bilingual
// rich-text HTML (#273) — the page picks the field for the current locale.
export interface JobOfferPublic {
  id: number;
  title: string;
  descriptionFr: string;
  descriptionEn: string;
  url: string;
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
  jobOffers: JobOfferPublic[];
}

// A sponsor with its job offers, for the recap page (#251).
export interface SponsorWithOffers {
  slug: string;
  name: string;
  logoUrl: string | null;
  level: SponsorLevel;
  jobOffers: JobOfferPublic[];
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

export type TalkFormat = "CONFERENCE" | "QUICKIE" | "KEYNOTE" | "WORKSHOP";
export type TalkLevel = "DEBUTANT" | "INTERMEDIAIRE" | "CONFIRME";

// Past-edition history items (issue #63), keyed by year (not by featured edition).
export interface EditionSpeaker {
  slug: string;
  name: string;
  photoUrl: string | null;
  company: string | null;
}

export interface EditionTalk {
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  format: TalkFormat;
  level: TalkLevel | null;
  language: string;
  videoUrl: string | null;
  category: { nameFr: string; nameEn: string; color: string } | null;
  speakers: { slug: string; name: string; photoUrl: string | null }[];
}

// Public talk detail.
export interface TalkDetail {
  id: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  format: TalkFormat;
  level: TalkLevel | null;
  language: string;
  category: { nameFr: string; nameEn: string; color: string } | null;
  speakers: { slug: string; name: string; photoUrl: string | null; company: string | null }[];
}

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
  contactEmail: string | null;
  locale: string;
  editLinkLocked: boolean;
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
