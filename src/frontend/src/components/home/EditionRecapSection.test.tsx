import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";

// #872 — the day after the event, the home page leans on what already exists:
// the talks, the speakers, the archives, and the replays once at least half
// the talks have one, the word that they are coming until then.

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: EditionRecapSection, areReplaysReady } = await import("./EditionRecapSection");

const talks = (withReplay: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({ videoUrl: i < withReplay ? `https://youtu.be/${i}` : null }));

function renderSection(hasReplays: boolean, messages = fr, locale = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <EditionRecapSection year={2026} hasReplays={hasReplays} />
    </NextIntlClientProvider>,
  );
}

describe("areReplaysReady (#872)", () => {
  it("should wait while fewer than half the talks have a replay", () => {
    expect(areReplaysReady(talks(26, 54))).toBe(false);
  });

  it("should open the replays from exactly half the talks", () => {
    expect(areReplaysReady(talks(27, 54))).toBe(true);
  });

  it("should not announce replays for an edition without talks", () => {
    expect(areReplaysReady([])).toBe(false);
  });
});

describe("EditionRecapSection (#872)", () => {
  it("should lead to the talks, the speakers and the archives, and say the replays are coming", () => {
    renderSection(false);

    expect(screen.getByRole("heading", { name: "Merci pour le DevFest 2026 !" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Les conférences/ })).toHaveAttribute("href", "/conferences");
    expect(screen.getByRole("link", { name: /Les speakers/ })).toHaveAttribute("href", "/speakers");
    expect(screen.getByRole("link", { name: /Les éditions précédentes/ })).toHaveAttribute("href", "/editions");
    expect(screen.getByText("Les replays arrivent bientôt")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Revoir les talks/ })).not.toBeInTheDocument();
  });

  it("should lead to the edition's replays once enough are online", () => {
    renderSection(true);

    expect(screen.getByRole("link", { name: /Revoir les talks/ })).toHaveAttribute("href", "/replays?year=2026");
    expect(screen.queryByText("Les replays arrivent bientôt")).not.toBeInTheDocument();
  });

  it("should speak English on the English site", () => {
    renderSection(false, en, "en");

    expect(screen.getByRole("heading", { name: "Thank you for DevFest 2026!" })).toBeInTheDocument();
    expect(screen.getByText("Replays coming soon")).toBeInTheDocument();
  });
});
