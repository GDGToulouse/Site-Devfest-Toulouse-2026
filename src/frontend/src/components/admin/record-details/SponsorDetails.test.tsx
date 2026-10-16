import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// #484 — the panel shows what the public page cannot (internal fields, the
// people and offers linked to the company) and links to the site only when
// there is a page to link to.
const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: SponsorDetails } = await import("./SponsorDetails");

const participation = {
  editionId: 9,
  edition: { id: 9, year: 2026 },
  tier: { nameFr: "Gold" },
  publicationStatus: "DRAFT",
  logoUrl: null,
  comKitReceived: true,
  comKitLogoWebUrl: null,
  comKitLogoPrintUrl: null,
  comKitCharterUrl: "/uploads/charte.pdf",
  comKitNotes: "Envoyé par mail le 3 octobre",
  platinumPromoIdea: null,
  platinumCoBuildIdea: null,
};

function mockSponsor(publicationStatus: "DRAFT" | "PUBLISHED") {
  adminFetch.mockImplementation(async (path: string) => {
    if (path === "/sponsors/3")
      return {
        status: 200,
        data: {
          id: 3,
          slug: "aeronova",
          name: "Aeronova",
          logoUrl: null,
          websiteUrl: null,
          descriptionFr: "<p>Une société</p>",
          descriptionEn: null,
          socialLinks: {},
          contactEmail: "partenariats@aeronova.example.com",
          locale: "fr",
          standContacts: [],
          editions: [{ ...participation, publicationStatus }],
          speakers: [{ id: 12, name: "Ada Lovelace", year: 2026 }],
        },
      };
    if (path === "/sponsors/3/contacts")
      return {
        status: 200,
        data: [{ id: 1, email: "rh@aeronova.example.com", name: "Rita", role: "RH", accessRole: "RESPONSABLE", hasAccount: false, invitationPending: true }],
      };
    return { status: 200, data: [{ id: 7, title: "Architecte Cloud", url: "https://x.org", year: 2026, editionId: 9 }] };
  });
}

describe("SponsorDetails (#484)", () => {
  beforeEach(() => adminFetch.mockReset());

  it("shows the internal fields and every link of the company", async () => {
    mockSponsor("PUBLISHED");
    render(<SponsorDetails sponsorId={3} onClose={() => {}} />);

    expect(await screen.findByText("partenariats@aeronova.example.com")).toBeInTheDocument();
    expect(screen.getByText("Envoyé par mail le 3 octobre")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute("href", "/admin/speakers/12");
    expect(screen.getByRole("link", { name: "Architecte Cloud" })).toHaveAttribute(
      "href",
      "/admin/sponsors/3?tab=offres&editionId=9&offer=7",
    );
    expect(screen.getByText(/invitation en attente/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir sur le site" })).toHaveAttribute("href", "/fr/sponsors/aeronova");
  });

  // #618: a draft has no public page, but the team previews it on the site.
  it("offers a preview instead of the public link while the company is only in draft", async () => {
    mockSponsor("DRAFT");
    render(<SponsorDetails sponsorId={3} onClose={() => {}} />);

    expect(await screen.findByRole("link", { name: "Prévisualiser sur le site" })).toHaveAttribute(
      "href",
      "/api/preview?type=sponsor&slug=aeronova",
    );
    expect(screen.queryByRole("link", { name: "Voir sur le site" })).not.toBeInTheDocument();
  });
});
