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
  share: "Partager les favoris",
  shareTitle: "Copier le lien de cette page, avec mes favoris",
  shareCopied: "Lien copié.",
  shareFailed: "La copie n'a pas fonctionné. Copiez l'adresse depuis la barre du navigateur.",
  shareEmptyTitle: "Aucun favori pour l'instant",
  shareEmptyBody: "Le lien partagera le programme complet.",
  shareEmptyChoose: "Choisir des favoris",
  shareEmptyConfirm: "Partager sans favoris",
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
      onReset={() => {}}
      categories={["Cloud & DevOps"]}
      languages={["fr"]}
      labels={labels}
      icsHref="/api/editions/2026/schedule.ics"
      hasFavourites
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
  it("is a select inside the panel, and drives the view", async () => {
    const user = userEvent.setup();
    const onChangeView = vi.fn();
    setup({ onChangeView });

    await user.click(screen.getByRole("button", { name: /Filtres/ }));
    const select = screen.getByRole("combobox", { name: "Vue" });
    expect(document.getElementById("programme-filter-panel")?.contains(select)).toBe(true);

    await user.selectOptions(select, "mine-only");
    expect(onChangeView).toHaveBeenCalledWith("mine-only");
  });

  it("counts toward the badge, so folding it away does not silence it", () => {
    // #459 kept this selector out of the panel precisely because folded meant
    // invisible: someone who starred sessions would have no visible sign that
    // most of the programme is being hidden (#442). Moving it in (#460) is only
    // acceptable while the closed button still says a restriction is applied.
    setup({ view: "mine-only" });

    expect(screen.getByRole("button", { name: /Filtres/ })).toHaveTextContent("1");
  });

  it("opens the panel on arrival when the link carries a view", () => {
    setup({ view: "mine" });

    expect(screen.getByRole("button", { name: /Filtres/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("clears the view and the filters through a single handler", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const onChangeView = vi.fn();
    const onChangeFilters = vi.fn();
    setup({ view: "mine-only", onReset, onChangeView, onChangeFilters });

    await user.click(screen.getByRole("button", { name: "Réinitialiser" }));

    // Not two calls in a row: each writes the URL from its own closure, and the
    // second rebuilt the query string from a state React had not updated yet —
    // observed in the browser, the category came back after being cleared.
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onChangeView).not.toHaveBeenCalled();
    expect(onChangeFilters).not.toHaveBeenCalled();
  });
});

describe("the export menu", () => {
  it("holds the three ways of taking the programme away", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /Exporter/ }));

    expect(screen.getByRole("button", { name: "Partager les favoris" })).toBeVisible();
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
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("status")).toHaveTextContent("Lien copié.");
  });

  it("lets the confirmation go once it has been read", async () => {
    vi.useFakeTimers();
    withClipboard(vi.fn().mockResolvedValue(undefined));
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
    await act(async () => {});

    // Closing the sheet is a decision, not a failure to report.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    Reflect.deleteProperty(navigator, "share");
  });
});

describe("sharing with nothing starred", () => {
  it("asks instead of copying, since the entry promises a selection", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    setup({ hasFavourites: false });

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));

    expect(screen.getByText("Aucun favori pour l'instant")).toBeVisible();
    expect(screen.getByRole("button", { name: "Choisir des favoris" })).toBeVisible();
    // Nothing has been sent: the question is asked before anything happens.
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies anyway once the visitor confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    setup({ hasFavourites: false });

    fireEvent.click(screen.getByRole("button", { name: /Exporter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
    fireEvent.click(screen.getByRole("button", { name: "Partager sans favoris" }));
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("status")).toHaveTextContent("Lien copié.");
  });

  it("closes and hands focus back when the visitor goes to pick some", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    setup({ hasFavourites: false });
    const trigger = screen.getByRole("button", { name: /Exporter/ });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
    fireEvent.click(screen.getByRole("button", { name: "Choisir des favoris" }));

    // The stars are on the cards, a step away — closing is the whole action.
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("drops the question when the menu is closed and reopened", () => {
    setup({ hasFavourites: false });
    const trigger = screen.getByRole("button", { name: /Exporter/ });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Partager les favoris" }));
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    // Reopening on a half-answered question would be a state nobody asked for.
    expect(screen.queryByText("Aucun favori pour l'instant")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Partager les favoris" })).toBeVisible();
  });
});
