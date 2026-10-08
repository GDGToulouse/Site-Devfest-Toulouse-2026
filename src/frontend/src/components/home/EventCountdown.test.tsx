import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import EventCountdown from "./EventCountdown";

const START = "2026-11-19T00:00:00.000Z";

function renderAt(now: string, locale: "fr" | "en" = "fr") {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <EventCountdown startDate={START} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("EventCountdown (#576)", () => {
  it("should count the days left", async () => {
    renderAt("2026-10-27T10:00:00.000Z");
    expect(await screen.findByText("Dans 23 jours")).toBeInTheDocument();
  });

  it("should say tomorrow the day before", async () => {
    renderAt("2026-11-18T10:00:00.000Z");
    expect(await screen.findByText("Demain")).toBeInTheDocument();
  });

  it("should say it is today on the day", async () => {
    renderAt("2026-11-19T10:00:00.000Z", "en");
    expect(await screen.findByText("Today")).toBeInTheDocument();
  });

  it("should disappear once the event is over", () => {
    const { container } = renderAt("2026-11-20T10:00:00.000Z");
    expect(container).toBeEmptyDOMElement();
  });
});
