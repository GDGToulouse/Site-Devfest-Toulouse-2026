import { describe, it, expect } from "vitest";
import {
  findOffer,
  isCareersLink,
  offerDescription,
  offerExcerpt,
  offerIdFromSegment,
  offerOnlyLocale,
  offerPath,
  offerSegment,
} from "./job-offers";
import type { JobOfferPublic, SponsorWithOffers } from "./types";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

// #556 — partner job offers: a compact list and one page per offer.

function offer(overrides: Partial<JobOfferPublic> = {}): JobOfferPublic {
  return {
    id: 12,
    title: "Architecte IA Senior H/F – Toulouse",
    descriptionFr: "<p><strong>Nous recrutons</strong> un architecte.</p>",
    descriptionEn: "",
    url: "https://example.com/job",
    ...overrides,
  };
}

describe("offerDescription", () => {
  it("should fall back to French when an English page has no English text (#273)", () => {
    expect(offerDescription(offer(), "en")).toBe("<p><strong>Nous recrutons</strong> un architecte.</p>");
  });

  it("should prefer the English text on an English page", () => {
    expect(offerDescription(offer({ descriptionEn: "<p>We hire</p>" }), "en")).toBe("<p>We hire</p>");
  });
});

describe("offerOnlyLocale", () => {
  it("should give one canonical locale to an offer written in French only (#468)", () => {
    expect(offerOnlyLocale(offer({ descriptionEn: "<p></p>" }))).toBe("fr");
  });

  it("should give no canonical locale to an offer written in both languages", () => {
    expect(offerOnlyLocale(offer({ descriptionEn: "<p>We hire</p>" }))).toBeUndefined();
  });
});

describe("isCareersLink", () => {
  it("should treat an offer with no description as a link to the careers site", () => {
    expect(isCareersLink(offer({ descriptionFr: "", descriptionEn: "" }))).toBe(true);
  });

  it("should treat an empty paragraph left by the editor as no description", () => {
    expect(isCareersLink(offer({ descriptionFr: "<p></p>", descriptionEn: "" }))).toBe(true);
  });

  it("should keep an offer with a description as a job ad", () => {
    expect(isCareersLink(offer())).toBe(false);
  });
});

describe("offerExcerpt", () => {
  it("should give plain text without tags or entities", () => {
    expect(offerExcerpt(offer({ descriptionFr: "<h3>Qui sommes-nous&nbsp;?</h3><p>R&amp;D &#x1F94B; 2002</p>" }), "fr")).toBe(
      "Qui sommes-nous ? R&D 🥋 2002",
    );
  });

  it("should cut a long description on a word and mark the cut", () => {
    const excerpt = offerExcerpt(offer({ descriptionFr: `<p>${"mot ".repeat(100)}</p>` }), "fr", 50);
    expect(excerpt).toBe("mot mot mot mot mot mot mot mot mot mot mot mot…");
  });
});

describe("offer addresses", () => {
  it("should build a readable segment from the id and the title", () => {
    expect(offerSegment(offer())).toBe("12-architecte-ia-senior-h-f-toulouse");
    expect(offerPath(offer())).toBe("/offres-emploi-partenaires/12-architecte-ia-senior-h-f-toulouse");
  });

  it("should fall back to the bare id when the title has no letter or digit", () => {
    expect(offerSegment(offer({ title: "🚀" }))).toBe("12");
  });

  it("should read the id from a segment, even with an outdated title", () => {
    expect(offerIdFromSegment("12-ancien-titre")).toBe(12);
    expect(offerIdFromSegment("12")).toBe(12);
  });

  it("should reject a segment that does not start with an id", () => {
    expect(offerIdFromSegment("architecte-12")).toBeNull();
    expect(offerIdFromSegment("12abc")).toBeNull();
  });
});

describe("findOffer", () => {
  const sponsors: SponsorWithOffers[] = [
    { slug: "celad", name: "Celad", logoUrl: null, jobOffers: [offer({ id: 3 }), offer({ id: 12 })] },
  ];

  it("should find an offer with its sponsor", () => {
    expect(findOffer(sponsors, 12)?.sponsor.name).toBe("Celad");
  });

  it("should return null for an unknown offer", () => {
    expect(findOffer(sponsors, 99)).toBeNull();
  });
});

// The two pages read these keys from the "jobOffers" namespace: a missing one
// shows its raw key on the page instead of failing anywhere.
describe("job offer pages — translations", () => {
  const keys = ["title", "heading", "intro", "empty", "home", "cta", "readOffer", "careersLink", "careersHint", "backToList", "offerTitle", "postedBy"] as const;

  it.each(keys)("should resolve jobOffers.%s in French and English", (key) => {
    expect(fr.jobOffers[key]).toBeTruthy();
    expect(en.jobOffers[key]).toBeTruthy();
  });
});
