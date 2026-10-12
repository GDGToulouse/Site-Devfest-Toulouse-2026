import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";

// #577 — the last week's section leads to what helps through the day, and
// shows only the cards whose target exists.

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: DayPlanSection } = await import("./DayPlanSection");

function renderSection(edition: { isScheduleReady: boolean; hasVenueInfo: boolean }, isToday = false) {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <DayPlanSection edition={{ year: 2026, ...edition }} isToday={isToday} />
    </NextIntlClientProvider>,
  );
}

describe("DayPlanSection (#577)", () => {
  it("should lead to the programme, the calendar file and the venue", () => {
    renderSection({ isScheduleReady: true, hasVenueInfo: true });

    expect(screen.getByRole("heading", { name: "Préparez votre journée" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Votre programme/ })).toHaveAttribute("href", "/programme");
    expect(screen.getByRole("link", { name: /Dans votre agenda/ })).toHaveAttribute("href", "/api/editions/2026/schedule.ics");
    expect(screen.getByRole("link", { name: /Venir sur place/ })).toHaveAttribute("href", "/lieu");
  });

  it("should leave out the cards with nothing behind them", () => {
    renderSection({ isScheduleReady: false, hasVenueInfo: true });

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("should say it is today on the day", () => {
    renderSection({ isScheduleReady: true, hasVenueInfo: false }, true);

    expect(screen.getByRole("heading", { name: "C’est aujourd’hui !" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Le programme du jour/ })).toBeInTheDocument();
  });

  it("should stay out of the way when nothing is ready", () => {
    const { container } = renderSection({ isScheduleReady: false, hasVenueInfo: false });

    expect(container).toBeEmptyDOMElement();
  });
});
