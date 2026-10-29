import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// #727 — guest registration ships asleep: while it is off, the Sponsoring tab
// must not explain a "places invités" column it does not show.

vi.mock("@/lib/admin-api", () => ({ adminFetch: vi.fn() }));
vi.mock("@/components/admin/ImagePickerDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/FilePickerDialog", () => ({ default: () => null }));

const { adminFetch } = await import("@/lib/admin-api");
const { default: SponsoringTab } = await import("./SponsoringTab");

beforeEach(() => {
  vi.mocked(adminFetch).mockResolvedValue({ data: null, status: 200 } as never);
});

describe("SponsoringTab guest places help (#727)", () => {
  it("should not mention guest places while guest registration is off", async () => {
    render(<SponsoringTab editionId={1} showGuestPlaces={false} />);

    // The help sits under this heading, rendered once loading is over.
    expect(await screen.findByText("Offres sur « Devenir sponsor »")).toBeInTheDocument();
    expect(screen.queryByText(/places invités/i)).not.toBeInTheDocument();
  });

  it("should explain guest places when guest registration is on", async () => {
    render(<SponsoringTab editionId={1} showGuestPlaces />);

    expect(await screen.findByText(/Les places invités sont le nombre de personnes/)).toBeInTheDocument();
  });
});
