import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// #585 — the General tab says when the home page will go to "Jour J" by itself.

vi.mock("@/lib/admin-api", () => ({ adminFetch: vi.fn() }));
vi.mock("@/components/admin/ImagePickerDialog", () => ({ default: () => null }));

const { default: GeneralTab } = await import("./GeneralTab");

function renderTab(status: string) {
  const edition = {
    id: 1,
    year: 2026,
    startDate: "2026-11-19T00:00:00.000Z",
    endDate: null,
    status,
    heroImageUrl: null,
    sponsorFormUrl: null,
    aftermovieUrl: null,
    galleryUrl: null,
    archivedSiteUrl: null,
  };
  return render(<GeneralTab edition={edition} onSaved={vi.fn()} />);
}

describe("GeneralTab automatic event day (#585)", () => {
  it("should announce the midnight switch for an edition in its last week", () => {
    renderTab("PROGRAMME");

    expect(screen.getByRole("status")).toHaveTextContent("Passera automatiquement en « Jour J » le 19 novembre 2026 à minuit.");
  });

  it("should announce nothing for an edition not ready for it", () => {
    renderTab("ANNOUNCEMENT");

    expect(screen.queryByText(/Passera automatiquement/)).not.toBeInTheDocument();
  });
});
