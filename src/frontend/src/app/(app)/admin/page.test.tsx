import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// #755 — the plain programme for partners is unlisted on the site: the
// dashboard is where the team finds the link to send.
const adminFetch = vi.fn(async (path: string) => {
  if (path === "/editions/current") {
    return {
      data: {
        id: 3,
        year: 2026,
        status: "TICKETING",
        startDate: null,
        venueName: null,
        venueAddress: null,
        sponsorFormUrl: null,
        heroImageUrl: null,
      },
      status: 200,
    };
  }
  return { data: null, status: 200 };
});
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (path: string) => adminFetch(path),
}));

const { default: AdminDashboard } = await import("./page");

describe("Admin dashboard (#755)", () => {
  it("links to the plain programme of the featured edition", async () => {
    render(<AdminDashboard />);

    const link = await screen.findByRole("link", { name: /\/fr\/programme\/texte$/ });
    expect(link).toHaveAttribute("href", `${window.location.origin}/fr/programme/texte`);
    expect(screen.getByText("Programme pour les partenaires")).toBeInTheDocument();
  });
});
