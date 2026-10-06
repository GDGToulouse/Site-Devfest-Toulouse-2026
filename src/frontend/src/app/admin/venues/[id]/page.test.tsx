import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #533 — SaveFeedback scrolls to its message (#453). Rendered at the top of the
// venue page, the message of a room added at the bottom pulled the whole page
// up on every add. Room actions now report inside the "Salles" section, next to
// the form, where the scroll has nothing to move.

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
    return Promise.resolve({ data: VENUE, status: 200 });
  });
});

function roomsSection() {
  return screen.getByRole("heading", { name: "Salles" }).closest("section") as HTMLElement;
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
    await userEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));

    expect(await within(roomsSection()).findByRole("alert")).toHaveTextContent("La salle n'a pas pu être supprimée.");
  });
});
