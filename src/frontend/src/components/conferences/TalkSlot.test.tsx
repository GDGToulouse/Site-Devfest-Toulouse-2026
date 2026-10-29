import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import TalkSlot from "./TalkSlot";

// #717 — the talk page says when and where: the page a participant opens from
// the programme, a favourite or the speaker's QR code, to know where to go.

type Props = Parameters<typeof TalkSlot>[0];

const placed: Props = {
  startsAt: "2026-11-19T16:30:00.000Z",
  endsAt: "2026-11-19T17:15:00.000Z",
  room: "Amphithéâtre",
  simulcasts: [],
};

// A missing key would not throw: next-intl prints its path. `onError` turns
// that into a failure, so every key the block produces must resolve.
function renderSlot(props: Props, locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone="Europe/Paris"
      onError={(error) => {
        throw error;
      }}
    >
      <TalkSlot {...props} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("TalkSlot (#717)", () => {
  it("gives the day, the hours and the room of a placed talk", () => {
    const { container } = renderSlot(placed);
    expect(container.textContent).toBe("Jeudi 19 novembre · 17:30 – 18:15 · Amphithéâtre");
  });

  it("speaks English on /en", () => {
    const { container } = renderSlot(placed, "en");
    expect(container.textContent).toBe("Thursday 19 November · 17:30 – 18:15 · Amphithéâtre");
  });

  it("names the rooms a keynote is relayed to", () => {
    const simulcasts = [
      { roomId: 2, room: "Agora 1" },
      { roomId: null, room: "Agora 2" },
    ];
    expect(renderSlot({ ...placed, simulcasts }).container.textContent).toBe(
      "Jeudi 19 novembre · 17:30 – 18:15 · Amphithéâtre · Retransmission : Agora 1 et Agora 2",
    );
    expect(renderSlot({ ...placed, simulcasts }, "en").container.textContent).toBe(
      "Thursday 19 November · 17:30 – 18:15 · Amphithéâtre · Live relay: Agora 1 and Agora 2",
    );
  });

  it("skips a relay whose room label was never frozen", () => {
    const { container } = renderSlot({ ...placed, simulcasts: [{ roomId: 3, room: null }] });
    expect(container.textContent).toBe("Jeudi 19 novembre · 17:30 – 18:15 · Amphithéâtre");
  });

  it("gives the hours alone when the talk has no room yet", () => {
    const { container } = renderSlot({ ...placed, room: null });
    expect(container.textContent).toBe("Jeudi 19 novembre · 17:30 – 18:15");
  });

  it("gives the start alone when the talk has no end", () => {
    const { container } = renderSlot({ ...placed, endsAt: null });
    expect(container.textContent).toBe("Jeudi 19 novembre · 17:30 · Amphithéâtre");
  });

  it("renders nothing at all for a talk not placed yet", () => {
    const { container } = renderSlot({ startsAt: null, endsAt: null, room: null, simulcasts: [] });
    expect(container.innerHTML).toBe("");
  });

  it("keeps Toulouse time when the server runs on UTC", async () => {
    vi.resetModules();
    vi.stubEnv("TZ", "UTC");
    // The provider is reloaded too: the fresh module graph has its own context.
    const { NextIntlClientProvider: Provider } = await import("next-intl");
    const { default: OnUtcServer } = await import("./TalkSlot");
    const { container } = render(
      <Provider locale="fr" messages={fr} timeZone="Europe/Paris">
        <OnUtcServer {...placed} />
      </Provider>,
    );
    expect(container.textContent).toBe("Jeudi 19 novembre · 17:30 – 18:15 · Amphithéâtre");
  });
});
