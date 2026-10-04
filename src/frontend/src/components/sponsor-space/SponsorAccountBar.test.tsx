import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// #411 — the partner space showed the company, never the person signed in.

const { getSponsorAccount, router } = vi.hoisted(() => ({
  getSponsorAccount: vi.fn(),
  router: { replace: vi.fn(), push: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/sponsor-api", () => ({ getSponsorAccount }));
vi.mock("@/lib/admin-api", () => ({ signOut: vi.fn() }));

import SponsorAccountBar from "./SponsorAccountBar";

async function renderBar() {
  await act(async () => {
    render(<SponsorAccountBar />);
  });
}

beforeEach(() => getSponsorAccount.mockReset());

describe("SponsorAccountBar", () => {
  it("shows the name and the address of the signed-in account", async () => {
    getSponsorAccount.mockResolvedValue({
      data: { id: "u1", email: "jane@acme.example", name: "Jane Doe" },
      status: 200,
    });

    await renderBar();

    expect(screen.getByText("jane@acme.example")).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });

  it("links to the account page and offers to sign out", async () => {
    getSponsorAccount.mockResolvedValue({ data: { id: "u1", email: "jane@acme.example", name: null }, status: 200 });

    await renderBar();

    expect(screen.getByRole("link", { name: "Mon compte" })).toHaveAttribute("href", "/sponsor/account");
    expect(screen.getByRole("button", { name: "Déconnexion" })).toBeInTheDocument();
  });

  it("keeps its links when the identity cannot be loaded", async () => {
    getSponsorAccount.mockResolvedValue({ data: null, status: 0 });

    await renderBar();

    expect(screen.getByRole("link", { name: "Mon compte" })).toBeInTheDocument();
  });
});
