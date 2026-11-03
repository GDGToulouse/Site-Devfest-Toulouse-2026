import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import type { SponsorSpaceProfile } from "@/lib/sponsor-api";

// TipTap does not run in jsdom; a textarea stands in so the test can type HTML.
vi.mock("@/components/admin/RichTextEditor", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const saveSponsorProfile = vi.fn();
vi.mock("@/lib/sponsor-api", () => ({
  saveSponsorProfile: (...args: unknown[]) => saveSponsorProfile(...args),
}));

const { default: PublicTab } = await import("./PublicTab");

const profile = { id: 15, descriptionFr: "", descriptionEn: "", socialLinks: {}, editions: [] } as unknown as SponsorSpaceProfile;

describe("PublicTab — description length (#610)", () => {
  it("blocks a description over the limit and names it", async () => {
    render(<PublicTab profile={profile} canEdit onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("Description (English)"), {
      target: { value: `<p>${"a".repeat(5_000)}</p>` },
    });

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La description en anglais est trop longue");
    expect(saveSponsorProfile).not.toHaveBeenCalled();
  });
});

// #687 — a logo given by its address is imported by the backend on save.
describe("PublicTab — logo given by its address (#687)", () => {
  const withLogo = { ...profile, logoUrl: "https://brand.example.org/logo.png" } as SponsorSpaceProfile;

  it("shows the imported copy once saved", async () => {
    saveSponsorProfile.mockResolvedValueOnce({ status: 200, data: { saved: true, logoUrl: "/uploads/123-abc.png" } });
    render(<PublicTab profile={withLogo} canEdit onSaved={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Modifications enregistrées.")).toBeInTheDocument();
    expect(screen.getByAltText("Aperçu du logo")).toHaveAttribute("src", "/uploads/123-abc.png");
  });

  it("says why the logo was not imported", async () => {
    saveSponsorProfile.mockResolvedValueOnce({
      status: 422,
      data: null,
      error: "image_import_failed",
      message: "Le site distant n'a pas répondu à temps. Réessayez plus tard.",
    });
    render(<PublicTab profile={withLogo} canEdit onSaved={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Le logo n'a pas été importé : le site distant n'a pas répondu à temps. Réessayez plus tard.",
    );
  });
});
