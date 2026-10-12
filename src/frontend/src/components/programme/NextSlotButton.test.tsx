import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import type { ScheduleRow } from "@/lib/schedule";
import NextSlotButton from "./NextSlotButton";

// #575 — the button exists on the day only, names the time it leads to, and
// takes the visitor to that row.

const rows = [
  { type: "band", key: "band:break", startsAt: "2026-11-19T09:35:00.000Z", entry: { startsAt: "2026-11-19T09:35:00.000Z", endsAt: "2026-11-19T10:00:00.000Z" } },
  { type: "slot", key: "slot:1100", startsAt: "2026-11-19T10:00:00.000Z", cells: [[{ talk: { endsAt: "2026-11-19T10:45:00.000Z" } }]], covered: [false] },
] as unknown as ScheduleRow[];

function renderAt(search: string, locale: "fr" | "en" = "fr") {
  window.history.replaceState(null, "", `/programme${search}`);
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <div data-slot="slot:1100" tabIndex={-1}>
        Créneau de 11 h
      </div>
      <NextSlotButton rows={rows} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("NextSlotButton (#575)", () => {
  it("should name the next slot at the simulated time and take the visitor there", async () => {
    // jsdom lays nothing out: pretend the target row is the visible one.
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
    renderAt("?now=2026-11-19T10:40");

    await userEvent.click(await screen.findByRole("button", { name: "Prochain créneau · 11:00" }));

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
    expect(document.activeElement).toHaveTextContent("Créneau de 11 h");
  });

  it("should not exist outside the day", async () => {
    renderAt("?now=2026-11-18T10:00");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should speak English to an English visitor", async () => {
    renderAt("?now=2026-11-19T10:40", "en");

    expect(await screen.findByRole("button", { name: "Next slot · 11:00" })).toBeInTheDocument();
  });
});
