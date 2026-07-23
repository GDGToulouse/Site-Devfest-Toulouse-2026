export type SponsorPageStatus = "PRE_ANNOUNCEMENT" | "TEMPORARY" | "OPEN" | "SOLD_OUT";

export interface Edition {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: "PREPARATION" | "ANNOUNCEMENT" | "SEE_YOU_NEXT_YEAR";
  venueName: string | null;
  venueAddress: string | null;
  // Venue & practical-info page (#109). Coordinates drive the map; transports/
  // parking are sanitized rich-text HTML; hasVenueInfo gates the nav entry.
  venueLat: number | null;
  venueLng: number | null;
  venueTransports: string | null;
  venueParking: string | null;
  venueDirectionsUrl: string | null;
  hasVenueInfo: boolean;
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

// A sponsoring offer shown on /devenir-sponsor (#318). One row of the shared
// SponsorTier catalogue, joined to the current edition (price is the edition
// override). Replaces the former SponsorPlan.
export interface SponsorTierPublic {
  id: number;
  nameFr: string;
  nameEn: string;
  subtitleFr: string | null;
  subtitleEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  standSize: string | null;
  color: string;
  logoScale: number;
  advantages: { fr: string; en: string }[];
  price: string | null;
}

// The catalogue tier as seen by the admin (#318 select, #319 CRUD).
export interface AdminSponsorTier {
  id: number;
  key: string;
  nameFr: string;
  nameEn: string;
  subtitleFr: string | null;
  subtitleEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  advantages: { fr: string; en: string }[];
  standSize: string | null;
  color: string;
  logoScale: number;
  rank: number;
  jobOfferQuota: number;
  allowsPromoIdeas: boolean;
}

// The tier summary the public sponsor routes expose (#321): drives grouping,
// ordering (rank), banner colour and logo size on the wall.
export interface SponsorTierRef {
  key: string;
  rank: number;
  nameFr: string;
  nameEn: string;
  logoScale: number;
  color: string;
}

// The tier summary the admin sponsor routes expose (#321): the name to show and
// the key/rank to filter and order by.
export interface AdminSponsorTierRef {
  key: string;
  nameFr: string;
  nameEn: string;
  rank: number;
}

export interface Sponsor {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  tierId: number;
  tier: AdminSponsorTierRef;
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
  tier: SponsorTierRef;
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
  tier: SponsorTierRef;
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

// A talk is single-language (#293): `title`/`description` hold its own wording,
// in the language given by `language`. Only Talk departs from the site's
// bilingual `*Fr`/`*En` convention — see docs/modele-donnees-metier.md.
export interface SpeakerTalkRef {
  slug: string;
  title: string;
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
  title: string;
  description: string;
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
  title: string;
  description: string;
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
  title: string;
  description: string;
  format: TalkFormat;
  level: TalkLevel | null;
  language: string;
  room: string | null;
  categoryId: number | null;
  category: { id: number; nameFr: string; color: string } | null;
  speakerIds: number[];
  speakers: { id: number; name: string }[];
  publicationStatus: "DRAFT" | "PUBLISHED";
  // Whether the speaker may edit the wording from their magic link (#289).
  isSpeakerEditable: boolean;
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
