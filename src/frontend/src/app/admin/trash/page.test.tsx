import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The page reads the session (role gating) and lists through adminFetch; the
// global purge goes through its own helper, since maintenance routes are not
// under /api/admin.
const adminFetch = vi.fn();
const getAdminSession = vi.fn();
const purgeExpiredTrash = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  getAdminSession: () => getAdminSession(),
  purgeExpiredTrash: () => purgeExpiredTrash(),
}));

const { default: TrashPage } = await import("./page");

const item = { id: 3, label: "Vieil article", deletedAt: "2026-06-01T10:00:00.000Z" };

function mockList() {
  adminFetch.mockImplementation((path: string) => {
    if (path === "/trash") {
      return Promise.resolve({ data: { entities: [{ entity: "articles", count: 1 }], total: 1 }, status: 200 });
    }
    return Promise.resolve({ data: { entity: "articles", retentionDays: 30, items: [item] }, status: 200 });
  });
}

beforeEach(() => {
  adminFetch.mockReset();
  getAdminSession.mockReset();
  purgeExpiredTrash.mockReset();
  getAdminSession.mockResolvedValue({ role: "ADMIN" });
  mockList();
});

// #335: with the scheduled purge disabled, the trash never emptied on its own.
// These lock the manual trigger: ADMIN-only, confirmed, and reporting what it
// actually destroyed — including the "nothing to purge" case.
describe("TrashPage manual purge (#335)", () => {
  it("purges expired items through a confirm dialog and reports the count", async () => {
    const user = userEvent.setup();
    render(<TrashPage />);

    const button = await screen.findByRole("button", { name: "Purger les éléments expirés" });
    await user.click(button);

    // Danger dialog states the retention window before destroying anything.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("30 jours");

    purgeExpiredTrash.mockResolvedValueOnce({
      data: { cutoff: "2026-06-24T00:00:00.000Z", retentionDays: 30, entities: [], totalPurged: 2 },
      status: 200,
    });
    await user.click(within(dialog).getByRole("button", { name: "Purger" }));

    await waitFor(() => expect(purgeExpiredTrash).toHaveBeenCalledOnce());
    const report = await screen.findByRole("status");
    expect(report).toHaveTextContent("2 éléments supprimés définitivement");
  });

  it("reports an empty purge as a neutral message, not an error", async () => {
    const user = userEvent.setup();
    render(<TrashPage />);

    await user.click(await screen.findByRole("button", { name: "Purger les éléments expirés" }));
    const dialog = await screen.findByRole("dialog");

    purgeExpiredTrash.mockResolvedValueOnce({
      data: { cutoff: "2026-06-24T00:00:00.000Z", retentionDays: 30, entities: [], totalPurged: 0 },
      status: 200,
    });
    await user.click(within(dialog).getByRole("button", { name: "Purger" }));

    const report = await screen.findByRole("status");
    expect(report).toHaveTextContent("Aucun élément");
    // Idempotent no-op must not look like a failure.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not purge when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(<TrashPage />);

    await user.click(await screen.findByRole("button", { name: "Purger les éléments expirés" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(purgeExpiredTrash).not.toHaveBeenCalled();
  });

  it("surfaces an expired session instead of a silent no-op", async () => {
    const user = userEvent.setup();
    render(<TrashPage />);

    await user.click(await screen.findByRole("button", { name: "Purger les éléments expirés" }));
    const dialog = await screen.findByRole("dialog");

    purgeExpiredTrash.mockResolvedValueOnce({ data: null, status: 401 });
    await user.click(within(dialog).getByRole("button", { name: "Purger" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("administrateurs");
  });

  it("hides the purge button from an EDITOR", async () => {
    getAdminSession.mockResolvedValue({ role: "EDITOR" });
    render(<TrashPage />);

    // Wait for the role to load: the page renders a placeholder until then.
    await screen.findByRole("heading", { name: "Corbeille" });
    expect(screen.queryByRole("button", { name: "Purger les éléments expirés" })).not.toBeInTheDocument();
  });
});
