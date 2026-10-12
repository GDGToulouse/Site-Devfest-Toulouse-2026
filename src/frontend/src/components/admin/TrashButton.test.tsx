import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const adminFetch = vi.fn();
const getAdminSession = vi.fn();
vi.mock("@/lib/admin-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-api")>()),
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  getAdminSession: () => getAdminSession(),
}));

const { default: TrashButton } = await import("./TrashButton");

// #599 — a record can be moved to the trash from its own page.

beforeEach(() => {
  push.mockReset();
  adminFetch.mockReset();
  getAdminSession.mockReset();
});
afterEach(cleanup);

function renderButton(props: Partial<Parameters<typeof TrashButton>[0]> = {}) {
  return render(
    <TrashButton path="/talks/12" listHref="/admin/talks" title="Supprimer la conférence" message="Elle ira à la corbeille." {...props} />,
  );
}

async function confirmTrash() {
  await userEvent.click(screen.getByRole("button", { name: "Mettre à la corbeille" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.querySelector("button:last-of-type") as HTMLElement);
}

describe("TrashButton (#599)", () => {
  it("should move the record to the trash and go back to the list once confirmed", async () => {
    adminFetch.mockResolvedValue({ data: null, status: 204 });
    renderButton();

    await confirmTrash();

    expect(adminFetch).toHaveBeenCalledWith("/talks/12", { method: "DELETE" });
    expect(push).toHaveBeenCalledWith("/admin/talks");
  });

  it("should keep the page and say so when the trash refused it", async () => {
    adminFetch.mockResolvedValue({ data: null, status: 0 });
    renderButton();

    await confirmTrash();

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/a échoué/);
  });

  it("should not show an ADMIN-only trash to an editor", async () => {
    getAdminSession.mockResolvedValue({ role: "EDITOR" });
    renderButton({ adminOnly: true });

    await waitFor(() => expect(getAdminSession).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Mettre à la corbeille" })).toBeNull();
  });
});
