import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../messages/fr.json";
import type { Edition } from "@/lib/types";

// #576 — the header is on every page: in the last month its sponsor call gives
// way to the ticket office.

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  // href and text only: the real Link's `prefetch` is no attribute of <a>.
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/",
}));
vi.mock("./LanguageSwitcher", () => ({ default: () => null }));

let edition: Partial<Edition> = {};
vi.mock("@/contexts/EditionContext", () => ({
  useEdition: () => edition,
  useCfpSettings: () => null,
  useIdentitySettings: () => null,
  useSocialLinks: () => ({}),
  useNavPages: () => [],
}));

const { default: Header } = await import("./Header");

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <Header />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  edition = { year: 2026, sponsorPageStatus: "OPEN" };
});

describe("Header (#576)", () => {
  it("should offer the ticket office instead of the sponsor call in the last month", () => {
    edition.status = "TICKETING";
    renderHeader();

    expect(screen.getByRole("link", { name: "Billetterie" })).toHaveAttribute("href", "/billetterie");
    expect(screen.queryByRole("link", { name: "Devenir sponsor" })).not.toBeInTheDocument();
  });

  it("should keep the sponsor call while the edition is announced", () => {
    edition.status = "ANNOUNCEMENT";
    renderHeader();

    expect(screen.getByRole("link", { name: "Devenir sponsor" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Billetterie" })).not.toBeInTheDocument();
  });

  it("should offer the programme in the last week and on the day (#577)", () => {
    edition.status = "PROGRAMME";
    renderHeader();

    expect(screen.getByRole("link", { name: "Programme" })).toHaveAttribute("href", "/programme");
    expect(screen.queryByRole("link", { name: "Billetterie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Devenir sponsor" })).not.toBeInTheDocument();
  });
});
