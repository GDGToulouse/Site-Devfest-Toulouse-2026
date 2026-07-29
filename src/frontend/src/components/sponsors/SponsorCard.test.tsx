import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: SponsorCard } = await import("./SponsorCard");

const sponsor = {
  id: 1,
  slug: "acme",
  name: "ACME Corp",
  logoUrl: "/uploads/acme.png" as string | null,
  tier: { key: "platinum", rank: 1, nameFr: "Platine", nameEn: "Platinum", logoScale: 1, color: "#123456" },
  websiteUrl: null,
};

describe("SponsorCard (#355)", () => {
  it("shows the logo alone, without repeating the name underneath", () => {
    render(<SponsorCard sponsor={sponsor} />);

    // The name still reaches assistive tech through the image's alt text, so
    // exactly one occurrence is expected — the visible caption is what goes.
    expect(screen.queryAllByText("ACME Corp")).toHaveLength(0);
    expect(screen.getByAltText("ACME Corp")).toBeInTheDocument();
  });

  it("falls back to the name when the sponsor has no logo", () => {
    // Never exercised by real data — the 28 published sponsors all have a logo —
    // so this guard is the only thing keeping the card from rendering empty.
    render(<SponsorCard sponsor={{ ...sponsor, logoUrl: null }} />);

    expect(screen.getByText("ACME Corp")).toBeInTheDocument();
  });

  it("links to the sponsor's own page", () => {
    render(<SponsorCard sponsor={sponsor} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/sponsors/acme");
  });
});
