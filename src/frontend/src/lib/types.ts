export interface Edition {
  id: number;
  year: number;
  startDate: string | null;
  endDate: string | null;
  status: "PREPARATION" | "ANNOUNCEMENT" | "SEE_YOU_NEXT_YEAR";
  aftermovieUrl: string | null;
  galleryUrl: string | null;
  archivedSiteUrl: string | null;
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
  status: "AVAILABLE" | "SOLD_OUT";
  externalUrl: string | null;
  sortOrder: number;
}

export interface KeyFigure {
  icon: string;
  value: string;
  labelFr: string;
  labelEn: string;
}
