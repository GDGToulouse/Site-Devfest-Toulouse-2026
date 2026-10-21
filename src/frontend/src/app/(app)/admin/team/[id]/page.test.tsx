import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #110 — an organiser is created ticked for the newest edition, and a link the
// backend refuses is named in the error rather than left to guess.

const push = vi.fn();
const params = { id: "new" };
vi.mock("next/navigation", () => ({
  useParams: () => params,
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/admin-api")>()),
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

vi.mock("@/components/admin/AuditTrail", () => ({ default: () => null }));

const { default: TeamMemberEditorPage } = await import("./page");

const EDITIONS = [
  { id: 1, year: 2025 },
  { id: 2, year: 2026 },
];

beforeEach(() => {
  push.mockReset();
  adminFetch.mockReset();
  params.id = "new";
});

describe("TeamMemberEditorPage (#110)", () => {
  it("should create the organiser ticked for the newest edition", async () => {
    adminFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === "POST") return { status: 201, data: { id: 42 } };
      return { status: 200, data: EDITIONS };
    });
    render(<TeamMemberEditorPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: "2026" })).toHaveAttribute("aria-pressed", "true"));
    await userEvent.type(screen.getByLabelText("Prénom *"), "Ada");
    await userEvent.type(screen.getByLabelText("Nom *"), "Lovelace");
    await userEvent.click(screen.getByRole("button", { name: "Créer" }));

    const post = adminFetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(post![1].body)).toMatchObject({ firstName: "Ada", lastName: "Lovelace", editionIds: [2] });
    expect(push).toHaveBeenCalledWith("/admin/team/42");
  });

  it("should name the link the backend refused", async () => {
    params.id = "7";
    adminFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === "PUT") return { status: 400, data: null, error: "invalid_field", errorBody: { error: "invalid_field", field: "githubUrl" } };
      if (path === "/team/7") {
        return {
          status: 200,
          data: { id: 7, firstName: "Ada", lastName: "Lovelace", photoUrl: null, websiteUrl: null, linkedinUrl: null, twitterUrl: null, githubUrl: null, blueskyUrl: null, editions: [] },
        };
      }
      return { status: 200, data: EDITIONS };
    });
    render(<TeamMemberEditorPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText(/Le lien GitHub n'est pas valide/)).toBeInTheDocument();
  });
});
