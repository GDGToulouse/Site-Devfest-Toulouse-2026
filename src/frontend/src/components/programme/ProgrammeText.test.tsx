import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import { ProgrammeTextView, type ProgrammeTextLabels } from "./ProgrammeText";
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
  entries: [],
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

function renderView(initialFields: Parameters<typeof ProgrammeTextView>[0]["initialFields"] = [], initialRoom: number | null = null) {
  return render(
    <ProgrammeTextView schedule={schedule} locale="fr" labels={labels} initialFields={initialFields} initialRoom={initialRoom} />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("ProgrammeText (#755)", () => {
  it("shows titles and speakers only by default", () => {
    renderView();

    expect(screen.getByText("Keynote d'ouverture")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.queryByText("09:00 – 09:45")).not.toBeInTheDocument();
    expect(screen.queryByText("Keynote")).not.toBeInTheDocument();
  });

  it("adds a field from the settings, and writes it into the address", async () => {
    renderView();

    await userEvent.click(screen.getByText("Affichage"));
    await userEvent.click(screen.getByLabelText("Horaire"));

    expect(screen.getByText("09:00 – 09:45")).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("fields")).toBe("time");
  });

  it("leaves a blank space under each session when notes are chosen", () => {
    const { container } = renderView(["notes"]);

    expect(container.querySelectorAll(".programme-text-notes")).toHaveLength(2);
  });

  it("shows a single room when one is chosen", async () => {
    renderView();

    await userEvent.selectOptions(screen.getByLabelText("Salle"), "2");

    expect(screen.queryByText("Keynote d'ouverture")).not.toBeInTheDocument();
    expect(screen.getByText("Atelier Agora")).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("room")).toBe("2");
  });

  it("shows every room for a room that does not exist", () => {
    renderView([], 99);

    expect(screen.getByText("Keynote d'ouverture")).toBeInTheDocument();
    expect(screen.getByText("Atelier Agora")).toBeInTheDocument();
  });

  it("copies a room as plain text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderView(["time"]);

    const amphi = screen.getByRole("heading", { name: "Amphi" }).closest("section")!;
    await userEvent.click(within(amphi).getByRole("button", { name: "Copier" }));

    expect(writeText).toHaveBeenCalledWith("09:00 – 09:45\tKeynote d'ouverture\tGrace Hopper");
    expect(within(amphi).getByText("Copié.")).toBeInTheDocument();
  });

  it("has every label of the page in both languages", () => {
    const keys = ["pageTitle", "heading", "intro", "empty", "room", "allRooms", "settings", "settingsTitle", "copy", "copyTitle", "copied", "copyFailed"];
    const fieldKeys = ["time", "format", "category", "language", "level", "notes"];
    for (const messages of [fr, en]) {
      const block = (messages as unknown as Record<string, Record<string, unknown>>).programmeText;
      for (const key of keys) expect(typeof block[key], key).toBe("string");
      for (const key of fieldKeys) expect(typeof (block.fields as Record<string, unknown>)[key], key).toBe("string");
    }
  });
});
