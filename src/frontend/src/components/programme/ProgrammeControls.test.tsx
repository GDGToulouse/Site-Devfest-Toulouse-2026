import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProgrammeControls from "./ProgrammeControls";
import type { ControlLabels } from "./ProgrammeControls";
import type { TalkFilters } from "@/lib/talk-filters";

// The control bar of #459: the chips fold away, the view selector does not, and
// the three ways of taking the programme with you live under one button.

const labels: ControlLabels = {
  filterZone: "Filtrer le programme",
  actionZone: "Actions sur le programme",
  filters: "Filtres",
  reset: "Réinitialiser",
  format: "Format",
  level: "Niveau",
  language: "Langue",
  category: "Catégorie",
  moreFilters: "Plus de filtres",
  viewLabel: "Vue",
  viewAll: "Tout le programme",
  viewMine: "Mes favoris et les moments communs",
  viewMineOnly: "Mes favoris seuls",
  formatLabels: { CONFERENCE: "Conférence", QUICKIE: "Quickie", KEYNOTE: "Keynote", WORKSHOP: "Workshop" },
  levelLabels: { DEBUTANT: "Débutant", INTERMEDIAIRE: "Intermédiaire", CONFIRME: "Confirmé" },
  languageLabels: { fr: "Français", en: "English" },
  exportMenu: "Exporter",
  exportMenuTitle: "Partager, exporter ou imprimer le programme",
  share: "Partager",
  shareTitle: "Copier le lien de cette page, avec mes favoris",
  shareCopied: "Lien copié.",
  shareFailed: "La copie n'a pas fonctionné. Copiez l'adresse depuis la barre du navigateur.",
  calendar: "Calendrier",
  exportTitle: "Exporter tout le programme vers mon agenda",
  printByTimeAction: "Imprimer par heure",
  printByRoomAction: "Imprimer par salle",
  printTitle: "Imprimer ou enregistrer le programme en PDF",
};

const noFilters: TalkFilters = { q: "", format: "", level: "", language: "", category: "" };

function setup(over: Partial<React.ComponentProps<typeof ProgrammeControls>> = {}) {
  return render(
    <ProgrammeControls
      view="all"
      onChangeView={() => {}}
      filters={noFilters}
      onChangeFilters={() => {}}
      categories={["Cloud & DevOps"]}
      languages={["fr"]}
      labels={labels}
      icsHref="/api/editions/2026/schedule.ics"
      printGrouping="time"
      onChangePrintGrouping={() => {}}
      {...over}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the filter panel", () => {
  it("is folded on arrival, at every width", () => {
    setup();

    // It only ever folded below `sm`: a 1440 px screen carried the chips whether
    // or not anyone had asked for them.
    expect(screen.getByRole("button", { name: /Filtres/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Conférence")).not.toBeVisible();
  });

  it("opens on arrival when the link already carries a filter", () => {
    setup({ filters: { ...noFilters, format: "KEYNOTE" } });

    // Otherwise a shared link renders a filtered grid and never says why.
    expect(screen.getByRole("button", { name: /Filtres/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("says a filter is applied without being opened", () => {
    setup({ filters: { ...noFilters, format: "KEYNOTE", category: "Cloud & DevOps" } });

    expect(screen.getByRole("button", { name: /Filtres/ })).toHaveTextContent("2");
  });
});

describe("the view selector", () => {
  it("stays out of the panel — folding it away would hide the favourites", () => {
    setup();

    // The panel is closed; the three states must still be reachable, or someone
    // who starred sessions has no visible way to show them alone (#442).
    const group = screen.getByRole("radiogroup", { name: "Vue" });
    expect(group).toBeVisible();
    expect(screen.getByRole("radio", { name: "Mes favoris seuls" })).toBeVisible();
  });
});

describe("the export menu", () => {
  it("holds the three ways of taking the programme away", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /Exporter/ }));

    expect(screen.getByRole("button", { name: "Partager" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Calendrier" })).toHaveAttribute(
      "href",
      "/api/editions/2026/schedule.ics",
    );
    expect(screen.getByRole("button", { name: "Imprimer par heure" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Imprimer par salle" })).toBeVisible();
  });

  it("closes on Escape and hands focus back", async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole("button", { name: /Exporter/ });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // A pointer user does not need this; a keyboard user cannot do without it.
    expect(trigger).toHaveFocus();
  });

  it("switches the grouping before printing, never after", async () => {
    const user = userEvent.setup();
    const onChangePrintGrouping = vi.fn();
    const print = vi.fn();
    vi.stubGlobal("print", print);
    setup({ printGrouping: "time", onChangePrintGrouping });

    await user.click(screen.getByRole("button", { name: /Exporter/ }));
    await user.click(screen.getByRole("button", { name: "Imprimer par salle" }));

    // The printed document is rendered from the grouping. Printing in the same
    // tick would put the by-hour document on paper under a by-room label.
    expect(onChangePrintGrouping).toHaveBeenCalledWith("room");
    expect(print).not.toHaveBeenCalled();
  });

  it("prints straight away when the grouping is already the right one", async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal("print", print);
    setup({ printGrouping: "time" });

    await user.click(screen.getByRole("button", { name: /Exporter/ }));
    await user.click(screen.getByRole("button", { name: "Imprimer par heure" }));

    expect(print).toHaveBeenCalledTimes(1);
  });
});

/**
 * Only the clipboard is replaced, never the whole navigator: user-event reads
 * other properties off it, and stubbing the object wholesale hangs the click.
 */
function withClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("sharing the link", () => {
  it("copies the address and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("status")).toHaveTextContent("Lien copié.");
  });

  it("lets the confirmation go once it has been read", async () => {
    vi.useFakeTimers();
    withClipboard(vi.fn().mockResolvedValue(undefined));
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    await act(async () => {});
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a failure on screen — one that fades reads as a success", async () => {
    vi.useFakeTimers();
    withClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    // The rejection settles on the microtask queue, which fake timers do not
    // hold back — flushing it is enough to get the message rendered.
    await act(async () => {});

    expect(screen.getByRole("alert")).toHaveTextContent(/n'a pas fonctionné/);

    // Same delay that dismisses a success, and then some.
    act(() => { vi.advanceTimersByTime(30000); });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("copies on a desktop even where the share sheet exists", async () => {
    // `navigator.share` is implemented by Chrome on Windows and Safari on
    // macOS. Keying on its existence sent desktop visitors to an OS dialog when
    // they had asked for a link, and left the page silent.
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    await act(async () => {});

    expect(writeText).toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();

    Reflect.deleteProperty(navigator, "share");
  });

  it("says nothing when the visitor dismisses the system share sheet", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    // A touch device: there the sheet is the right answer, and its own feedback.
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    await act(async () => {});

    // Closing the sheet is a decision, not a failure to report.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    Reflect.deleteProperty(navigator, "share");
  });
});
