import { htmlToText } from "./html";
import type { JobOfferPublic, SponsorWithOffers } from "./types";

// Partner job offers: a compact list and one page per offer (#556).

// Locale description with fallback to the other language (#273).
export function offerDescription(offer: JobOfferPublic, locale: string): string {
  return (locale === "en" ? offer.descriptionEn : offer.descriptionFr) || offer.descriptionFr || offer.descriptionEn;
}

// An offer with no description at all is a link to the partner's careers site
// ("Nos offres d'emploi"), not a job ad: it gets no page of its own and its card
// leads straight to the site. Derived from the data as it stands, no new field.
export function isCareersLink(offer: JobOfferPublic): boolean {
  return htmlToText(offer.descriptionFr).length === 0 && htmlToText(offer.descriptionEn).length === 0;
}

// An offer written in one language has one canonical page, like a talk (#468):
// the other locale only wraps the same words in translated chrome.
export function offerOnlyLocale(offer: JobOfferPublic): "fr" | "en" | undefined {
  const hasFr = htmlToText(offer.descriptionFr).length > 0;
  const hasEn = htmlToText(offer.descriptionEn).length > 0;
  if (hasFr && !hasEn) return "fr";
  if (hasEn && !hasFr) return "en";
  return undefined;
}

// Plain-text opening of the description for the list card and the page's meta
// description, cut on a word rather than mid-word.
export function offerExcerpt(offer: JobOfferPublic, locale: string, maxLength = 220): string {
  const text = htmlToText(offerDescription(offer, locale));
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!?–-]+$/, "")}…`;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

// `/offres-emploi-partenaires/12-architecte-ia-senior-h-f`: the id finds the
// offer, the title only makes the address readable. A title edited later
// changes the slug; the page redirects the old one rather than 404ing.
export function offerSegment(offer: JobOfferPublic): string {
  const slug = slugify(offer.title);
  return slug ? `${offer.id}-${slug}` : String(offer.id);
}

export function offerPath(offer: JobOfferPublic): string {
  return `/offres-emploi-partenaires/${offerSegment(offer)}`;
}

// The offer id at the head of a URL segment, or null when there is none.
export function offerIdFromSegment(segment: string): number | null {
  const match = /^(\d+)(?:-|$)/.exec(segment);
  return match ? Number(match[1]) : null;
}

export function findOffer(
  sponsors: SponsorWithOffers[],
  id: number,
): { sponsor: SponsorWithOffers; offer: JobOfferPublic } | null {
  for (const sponsor of sponsors) {
    const offer = sponsor.jobOffers.find((o) => o.id === id);
    if (offer) return { sponsor, offer };
  }
  return null;
}
