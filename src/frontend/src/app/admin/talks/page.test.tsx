import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #573 — the talk list keeps its filters in the URL and asks the API for one
// page, as the speakers list does (#572).
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/admin/talks",
  useSearchParams: () => searchParams,
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: TalksDataPage } = await import("./page");

const talk = {
  id: 7,
  title: "Kubernetes en production",
  format: "CONFERENCE",
  publicationStatus: "DRAFT",
  speakers: [{ id: 1, name: "Ada" }],
  category: null,
  startsAt: null,
  room: null,
  edition: { id: 1, year: 2026 },
};
let items: unknown[] = [talk];

beforeEach(() => {
  replace.mockReset();
  searchParams = new URLSearchParams();
  items = [talk];
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === "DELETE") return { status: 204 };
    if (path === "/editions") return { status: 200, data: [{ id: 1, year: 2026 }] };
    if (path === "/editions/1") return { status: 200, data: { venueId: 3 } };
    if (path === "/venues/3") return { status: 200, data: { rooms: [{ id: 9, name: "Amphi" }] } };
    if (path.startsWith("/categories")) return { status: 200, data: [] };
    return { status: 200, data: { page: 1, limit: 50, total: items.length, items } };
  });
});

const listCalls = () => adminFetch.mock.calls.map(([path]) => path as string).filter((p) => p.startsWith("/talks?"));

describe("TalksDataPage (#573)", () => {
  it("should ask the API for one page with the filters held in the URL", async () => {
    searchParams = new URLSearchParams("year=2026&scheduled=no&speakers=none");
    render(<TalksDataPage />);
    await screen.findByText("Kubernetes en production");

    const sent = new URLSearchParams(listCalls().at(-1)!.split("?")[1]);
    expect(Object.fromEntries(sent)).toEqual({ page: "1", limit: "50", editionId: "1", scheduled: "no", speakers: "none" });
  });

  it("should show an unscheduled session as such once an edition is chosen", async () => {
    searchParams = new URLSearchParams("year=2026");
    render(<TalksDataPage />);

    expect(await screen.findByText("Non planifiée")).toBeInTheDocument();
  });

  it("should offer the rooms of the chosen edition's venue", async () => {
    searchParams = new URLSearchParams("year=2026");
    const user = userEvent.setup();
    render(<TalksDataPage />);
    await screen.findByRole("option", { name: "Amphi" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Salle" }), "9");

    expect(replace).toHaveBeenCalledWith("/admin/talks?year=2026&room=9", { scroll: false });
  });

  it("should keep slot and room off until an edition is chosen", async () => {
    render(<TalksDataPage />);
    await screen.findByText("Kubernetes en production");

    expect(screen.getByRole("combobox", { name: "Programmation" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Salle" })).toBeDisabled();
  });

  it("should delete through a confirm dialog and reload the page", async () => {
    const user = userEvent.setup();
    render(<TalksDataPage />);
    await screen.findByText("Kubernetes en production");

    await user.click(screen.getByRole("button", { name: "Supprimer Kubernetes en production" }));
    items = [];
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledWith("/talks/7", { method: "DELETE" }));
    await waitFor(() => expect(screen.queryByText("Kubernetes en production")).not.toBeInTheDocument());
  });
});
