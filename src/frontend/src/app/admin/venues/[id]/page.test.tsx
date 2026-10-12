import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #533 — SaveFeedback scrolls to its message (#453). Rendered at the top of the
// venue page, the message of a room added at the bottom pulled the whole page
// up on every add. Room actions now report inside the "Salles" section, next to
// the form, where the scroll has nothing to move.
// #554 — a room is edited in place; deleting and re-adding it would detach its
// scheduled sessions.

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (_result: unknown, fallback: string) => fallback,
}));

// The rich-text editor drags in a heavy tree that has nothing to do with rooms.
vi.mock("@/components/admin/RichTextEditor", () => ({
  default: ({ name }: { name: string }) => <textarea data-testid={name} />,
}));

const { default: VenueDetailPage } = await import("./page");

const VENUE = {
  id: 7,
  name: "Diagora",
  address: "Labège",
  lat: null,
  lng: null,
  transports: null,
  parking: null,
  directionsUrl: null,
  rooms: [{ id: 1, name: "Amphithéâtre", capacity: 500, sortOrder: 1 }],
  editions: [],
};

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/venues/7/rooms" && options?.method === "POST") return Promise.resolve({ data: { id: 2 }, status: 201 });
    if (path === "/rooms/1" && options?.method === "DELETE") return Promise.resolve({ data: null, status: 409 });
    if (path === "/rooms/1" && options?.method === "PUT") return Promise.resolve({ data: { id: 1 }, status: 200 });
    return Promise.resolve({ data: VENUE, status: 200 });
  });
});

function roomsSection() {
  return screen.getByRole("heading", { name: "Salles" }).closest("section") as HTMLElement;
}

function roomUpdates() {
  return adminFetch.mock.calls.filter(([path, options]) => path === "/rooms/1" && options?.method === "PUT");
}

describe("Venue page — room feedback (#533)", () => {
  it("should report an added room inside the rooms section, next to its form", async () => {
    render(<VenueDetailPage />);
    await userEvent.type(await screen.findByLabelText("Nom de la salle"), "Agora 1");
    await userEvent.click(screen.getByRole("button", { name: "+ Ajouter" }));

    expect(await within(roomsSection()).findByRole("status")).toHaveTextContent("Salle ajoutée.");
  });

  it("should keep a refused deletion visible inside the rooms section (#453)", async () => {
    render(<VenueDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Supprimer Amphithéâtre" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));

    expect(await within(roomsSection()).findByRole("alert")).toHaveTextContent("La salle n'a pas pu être supprimée.");
  });
});

describe("Venue page — editing a room (#554)", () => {
  it("should save the new capacity of a room in place", async () => {
    render(<VenueDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Modifier Amphithéâtre" }));
    const capacity = screen.getByLabelText("Places", { selector: "#room-1-capacity" });
    await userEvent.clear(capacity);
    await userEvent.type(capacity, "503");
    await userEvent.click(within(roomsSection()).getByRole("button", { name: "Enregistrer" }));

    expect(JSON.parse(roomUpdates()[0][1].body)).toEqual({ name: "Amphithéâtre", capacity: 503, sortOrder: 1 });
    expect(await within(roomsSection()).findByRole("status")).toHaveTextContent("Salle modifiée.");
  });

  it("should keep a refused edit visible (#394)", async () => {
    adminFetch.mockImplementation((path: string, options?: { method?: string }) =>
      Promise.resolve(path === "/rooms/1" && options?.method === "PUT" ? { data: null, status: 409 } : { data: VENUE, status: 200 }),
    );
    render(<VenueDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Modifier Amphithéâtre" }));
    await userEvent.click(within(roomsSection()).getByRole("button", { name: "Enregistrer" }));

    expect(await within(roomsSection()).findByRole("alert")).toHaveTextContent("La salle n'a pas pu être modifiée.");
  });

  it("should leave the room untouched when the edit is cancelled", async () => {
    render(<VenueDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Modifier Amphithéâtre" }));
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(roomUpdates()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Modifier Amphithéâtre" })).toBeInTheDocument();
  });
});
