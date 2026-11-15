import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import TicketingSection from "./TicketingSection";
import type { TicketTier } from "@/lib/types";

// 16 November 2026, 23:55 in Toulouse.
const DEADLINE = "2026-11-16T22:55:00.000Z";

const NORMAL: TicketTier = {
  id: 1,
  nameFr: "Normal",
  nameEn: "Normal",
  price: 90,
  status: "AVAILABLE",
  externalUrl: "https://www.billetweb.fr/devfest-toulouse-2026?src=site",
  sortOrder: 0,
  saleStartDate: null,
};

function renderAt(now: string, tiers: TicketTier[] = [NORMAL], locale: "fr" | "en" = "fr") {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en} timeZone="Europe/Paris">
      <TicketingSection tiers={tiers} locale={locale} salesEndAt={DEADLINE} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("TicketingSection — registration deadline (#822)", () => {
  it("should name the deadline in Toulouse time and count down to it", () => {
    renderAt("2026-11-10T21:00:00.000Z");
    expect(screen.getByText("Inscriptions ouvertes jusqu'au lundi 16 novembre à 23:55")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("Plus que 6 j 01 h 55 min 00 s");
    expect(screen.getByRole("link", { name: "Acheter" })).toBeInTheDocument();
  });

  it("should drop the days on the last day", () => {
    renderAt("2026-11-16T20:00:00.000Z", [NORMAL], "en");
    expect(screen.getByRole("timer")).toHaveTextContent("2h 55m 00s left");
  });

  it("should grey the tickets out at the deadline, without a reload", () => {
    renderAt("2026-11-16T22:54:58.000Z");
    expect(screen.getByRole("link", { name: "Acheter" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByRole("link", { name: "Acheter" })).not.toBeInTheDocument();
    expect(screen.getByText("Inscriptions closes")).toBeInTheDocument();
    expect(screen.getByText("Les inscriptions sont closes depuis le lundi 16 novembre à 23:55.")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("should show a page rendered after the deadline as closed from the start", () => {
    renderAt("2026-11-17T08:00:00.000Z", [{ ...NORMAL, status: "CLOSED" }]);
    expect(screen.queryByRole("link", { name: "Acheter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Voir la billetterie" })).not.toBeInTheDocument();
  });

  it("should show no countdown when no deadline is set", () => {
    vi.useFakeTimers();
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <TicketingSection tiers={[NORMAL]} locale="fr" />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId("ticket-sales-countdown")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acheter" })).toBeInTheDocument();
  });
});
