import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../../../messages/fr.json";

// #611 — every company that ever sponsored, alphabetical by default and by
// number of editions on demand; under a year filter, as that year displayed it.

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    setRequestLocale: () => {},
    getTranslations: async (namespace: string) => createTranslator({ locale: "fr", messages: fr, namespace: namespace as never }),
  };
});
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const tier = (nameFr: string) => ({ key: nameFr, rank: 1, nameFr, nameEn: nameFr, color: "#109E6E" });
vi.mock("@/lib/api", () => ({
  getSponsorsHallOfFame: async () => [
    { slug: "capgemini", name: "Capgemini", logoUrl: null, participations: [{ year: 2019, logoUrl: null, tier: tier("Or") }] },
    {
      slug: "lyra",
      name: "Lyra",
      logoUrl: "/uploads/lyra-2026.png",
      participations: [
        { year: 2025, logoUrl: "/uploads/lyra-2026.png", tier: tier("Platinum") },
        { year: 2017, logoUrl: "/uploads/lyra-2017.png", tier: tier("Or 2017") },
      ],
    },
    { slug: "acme", name: "Acme", logoUrl: null, participations: [{ year: 2017, logoUrl: null, tier: tier("Argent") }] },
  ],
}));

const { default: SponsorsHallOfFamePage } = await import("./page");

async function renderPage(query: Record<string, string> = {}) {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      {await SponsorsHallOfFamePage({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve(query) })}
    </NextIntlClientProvider>,
  );
  return within(screen.getAllByRole("list").at(-1)!).getAllByRole("link").map((a) => a.getAttribute("href"));
}

describe("Sponsors hall of fame (#611)", () => {
  it("should list every company alphabetically, the name standing in for a missing logo", async () => {
    const order = await renderPage();

    expect(order).toEqual(["/sponsors/acme", "/sponsors/capgemini", "/sponsors/lyra"]);
    expect(screen.getByText("3 entreprises ont soutenu le DevFest Toulouse depuis 2016.")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("should put the most loyal first when sorted by participations", async () => {
    const order = await renderPage({ sort: "participations" });

    expect(order[0]).toBe("/sponsors/lyra");
    expect(screen.getByText("2 éditions")).toBeInTheDocument();
  });

  it("should show a year as it was displayed then, logo and tier included", async () => {
    const order = await renderPage({ year: "2017" });

    expect(order).toEqual(["/sponsors/acme", "/sponsors/lyra"]);
    expect(screen.getByRole("img", { name: "Lyra" })).toHaveAttribute("src", "/uploads/lyra-2017.png");
    expect(screen.getByText("Or 2017")).toBeInTheDocument();
    // The sort link keeps the year.
    expect(screen.getByRole("link", { name: "Par participations" })).toHaveAttribute(
      "href",
      "/sponsors/hall-of-fame?year=2017&sort=participations",
    );
  });
});
