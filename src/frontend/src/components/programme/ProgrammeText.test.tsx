import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import { ProgrammeTextView, type ProgrammeTextLabels } from "./ProgrammeText";
import type { TextField, TextGrouping } from "@/lib/programme-text";
import type { EditionSchedule } from "@/lib/types";

// The plain view of the programme (#755).

const schedule = {
  year: 2026,
  rooms: [
    { id: 1, name: "Amphi", sortOrder: 0 },
    { id: 2, name: "Agora", sortOrder: 1 },
  ],
  talks: [
    {
      slug: "k",
      title: "Keynote d'ouverture",
      format: "KEYNOTE",
      level: "DEBUTANT",
      language: "fr",
      category: null,
      speakers: [{ slug: "g", name: "Grace Hopper", photoUrl: null }],
      room: "Amphi",
      roomId: 1,
      simulcasts: [],
      startsAt: "2026-11-20T08:00:00.000Z",
      endsAt: "2026-11-20T08:45:00.000Z",
    },
    {
      slug: "a",
      title: "Atelier Agora",
      format: "WORKSHOP",
      level: "CONFIRME",
      language: "en",
      category: null,
      speakers: [{ slug: "l", name: "Ada Lovelace", photoUrl: null }],
      room: "Agora",
      roomId: 2,
      simulcasts: [],
      startsAt: "2026-11-20T09:00:00.000Z",
      endsAt: "2026-11-20T10:00:00.000Z",
    },
  ],
  entries: [
    {
      id: 3,
      kind: "BREAK",
      labelFr: "Pause",
      labelEn: "Break",
      startsAt: "2026-11-20T08:45:00.000Z",
      endsAt: "2026-11-20T09:00:00.000Z",
      roomId: null,
      room: null,
    },
  ],
} as unknown as EditionSchedule;

const labels: ProgrammeTextLabels = {
  formatLabels: { KEYNOTE: "Keynote", WORKSHOP: "Workshop" },
  levelLabels: { DEBUTANT: "Débutant", CONFIRME: "Confirmé" },
  languageLabels: { fr: "Français", en: "Anglais" },
  simulcast: "Retransmission",
  settings: "Affichage",
  settingsTitle: "Choisir les informations affichées",
  fieldLabels: {
    time: "Horaire",
    format: "Format",
    category: "Catégorie",
    language: "Langue",
    level: "Niveau",
    notes: "Espace pour des notes",
  },
  grouping: "Regrouper",
  byRoom: "Par salle",
  byTime: "Par horaire",
  room: "Salle",
  allRooms: "Toutes les salles",
  roomTba: "Salle à préciser",
  copy: "Copier",
  copyTitle: "Copier",
  copied: "Copié.",
  copyFailed: "Échec",
  common: "Moments communs",
  notes: "Espace pour des notes",
};

function renderView(
  { fields = ["time"], room = null, grouping = "room" }: { fields?: TextField[]; room?: number | null; grouping?: TextGrouping } = {},
) {
  return render(
    <ProgrammeTextView schedule={schedule} locale="fr" labels={labels} initial={{ fields, room, grouping }} />,
  );
}

const param = (name: string) => new URL(window.location.href).searchParams.get(name);

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("ProgrammeText (#755)", () => {
  it("shows times, titles and speakers by default, room by room", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "Amphi" })).toBeInTheDocument();
    expect(screen.getByText("09:00 – 09:45")).toBeInTheDocument();
    expect(screen.getByText("Keynote d'ouverture")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.queryByText("Keynote")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Par salle" })).toHaveAttribute("aria-pressed", "true");
  });

  it("drops the times from the settings, and keeps that choice in the address", async () => {
    renderView();

    await userEvent.click(screen.getByText("Affichage"));
    await userEvent.click(screen.getByLabelText("Horaire"));

    expect(screen.queryByText("09:00 – 09:45")).not.toBeInTheDocument();
    expect(param("fields")).toBe("");
  });

  it("switches to the day by time, each session with its room, breaks in place", async () => {
    renderView();

    await userEvent.click(screen.getByRole("button", { name: "Par horaire" }));

    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["09:00", "10:00"]);
    expect(screen.getByText("09:45 – 10:00 Pause")).toBeInTheDocument();
    const nine = screen.getByRole("heading", { name: "09:00" }).closest("section")!;
    expect(within(nine).getByText("Amphi")).toBeInTheDocument();
    expect(param("group")).toBe("time");
  });

  it("goes back to rooms and leaves the default out of the address", async () => {
    renderView({ grouping: "time" });

    await userEvent.click(screen.getByRole("button", { name: "Par salle" }));

    expect(screen.getByRole("heading", { name: "Agora" })).toBeInTheDocument();
    expect(param("group")).toBeNull();
  });

  it("leaves a blank space under each session when notes are chosen", () => {
    const { container } = renderView({ fields: ["notes"] });

    expect(container.querySelectorAll(".programme-text-notes")).toHaveLength(2);
  });

  it("shows a single room when one is chosen, in either grouping", async () => {
    renderView();

    await userEvent.selectOptions(screen.getByLabelText("Salle"), "2");
    expect(screen.queryByText("Keynote d'ouverture")).not.toBeInTheDocument();
    expect(screen.getByText("Atelier Agora")).toBeInTheDocument();
    expect(param("room")).toBe("2");

    await userEvent.click(screen.getByRole("button", { name: "Par horaire" }));
    expect(screen.queryByText("Keynote d'ouverture")).not.toBeInTheDocument();
    expect(screen.getByText("Atelier Agora")).toBeInTheDocument();
  });

  it("shows every room for a room that does not exist", () => {
    renderView({ room: 99 });

    expect(screen.getByText("Keynote d'ouverture")).toBeInTheDocument();
    expect(screen.getByText("Atelier Agora")).toBeInTheDocument();
  });

  it("copies a section as plain text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderView();

    const amphi = screen.getByRole("heading", { name: "Amphi" }).closest("section")!;
    await userEvent.click(within(amphi).getByRole("button", { name: "Copier" }));

    expect(writeText).toHaveBeenCalledWith("09:00 – 09:45\tKeynote d'ouverture\tGrace Hopper");
    expect(within(amphi).getByText("Copié.")).toBeInTheDocument();
  });

  it("has every label of the page in both languages", () => {
    const keys = [
      "pageTitle", "heading", "intro", "empty", "grouping", "byRoom", "byTime", "room", "allRooms",
      "settings", "settingsTitle", "copy", "copyTitle", "copied", "copyFailed",
    ];
    const fieldKeys = ["time", "format", "category", "language", "level", "notes"];
    for (const messages of [fr, en]) {
      const block = (messages as unknown as Record<string, Record<string, unknown>>).programmeText;
      for (const key of keys) expect(typeof block[key], key).toBe("string");
      for (const key of fieldKeys) expect(typeof (block.fields as Record<string, unknown>)[key], key).toBe("string");
    }
  });
});
