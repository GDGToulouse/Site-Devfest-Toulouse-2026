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
