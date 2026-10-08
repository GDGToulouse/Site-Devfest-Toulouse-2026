import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import type { Edition } from "@/lib/types";

// #576 — in the last month the hero sends visitors to the ticket office, says
// how many days are left, and no longer asks for sponsors.

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: HeroSection } = await import("./HeroSection");

const EDITION = {
  year: 2026,
  startDate: "2026-11-19T00:00:00.000Z",
  venueName: "Diagora",
  venueAddress: null,
  heroImageUrl: null,
  sponsorPageStatus: "OPEN",
} as unknown as Edition;

function renderHero(status: Edition["status"], tickets: "open" | "soldOut" | null) {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <HeroSection edition={{ ...EDITION, status }} cfp={null} locale="fr" tickets={tickets} />
    </NextIntlClientProvider>,
  );
}

// A fixed clock: the countdown reads the real date, and this suite must not
// start failing the day after the event.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HeroSection (#576)", () => {
  it("should lead to the ticket office and count down in the last month", async () => {
    renderHero("TICKETING", "open");

    expect(screen.getByRole("link", { name: "Prendre mon billet" })).toHaveAttribute("href", "/billetterie");
    expect(screen.queryByRole("link", { name: "Devenir sponsor" })).not.toBeInTheDocument();
    expect(await screen.findByText("Dans 23 jours")).toBeInTheDocument();
  });

  it("should say sold out, without a link, when every tier is gone", () => {
    renderHero("TICKETING", "soldOut");

    expect(screen.getByText("Complet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Complet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Prendre mon billet" })).not.toBeInTheDocument();
  });

  it("should keep the sponsor call and no countdown while the edition is announced", () => {
    renderHero("ANNOUNCEMENT", null);

    expect(screen.getByRole("link", { name: "Devenir sponsor" })).toHaveAttribute("href", "/devenir-sponsor");
    expect(screen.queryByRole("link", { name: "Prendre mon billet" })).not.toBeInTheDocument();
    expect(screen.queryByText("Dans 23 jours")).not.toBeInTheDocument();
  });

  it("should lead to the programme in the last week, the ticket coming second (#577)", () => {
    renderHero("PROGRAMME", "open");

    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(links.slice(0, 2)).toEqual(["Préparer mon programme", "Prendre mon billet"]);
    expect(screen.getByRole("link", { name: "Préparer mon programme" })).toHaveAttribute("href", "/programme");
  });

  it("should follow the day on the day itself, with nothing left to sell (#577)", () => {
    renderHero("EVENT_DAY", null);

    expect(screen.getByRole("link", { name: "Voir le programme du jour" })).toHaveAttribute("href", "/programme");
    expect(screen.queryByRole("link", { name: "Prendre mon billet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Devenir sponsor" })).not.toBeInTheDocument();
  });
});
