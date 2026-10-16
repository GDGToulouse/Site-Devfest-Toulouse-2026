import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SpeakerEditionsPanel from "./SpeakerEditionsPanel";
import type { SpeakerEdition } from "@/lib/types";

// #632 — this panel saves each status change at once. A badge inside the
// checkbox's label published or unpublished on a click that read as nothing;
// the change now says it was saved, and taking a speaker off a year asks first.

vi.mock("@/components/admin/speakers/ParticipationSponsorSelect", () => ({ default: () => null }));

const participation = { id: 1, year: 2026, publicationStatus: "PUBLISHED", isFeatured: false, sponsorId: null } as SpeakerEdition;

function renderPanel(onUpdate: (id: number, patch: object) => Promise<boolean>) {
  render(
    <SpeakerEditionsPanel
      speakerName="Ada Lovelace"
      speakerSlug="ada-lovelace"
      editions={[participation]}
      allEditions={[{ id: 1, year: 2026 }]}
      onAttach={async () => {}}
      onDetach={async () => {}}
      onUpdate={onUpdate}
    />,
  );
}

describe("SpeakerEditionsPanel status (#632)", () => {
  it("should confirm before unpublishing a year, then say it was done", async () => {
    const onUpdate = vi.fn().mockResolvedValue(true);
    renderPanel(onUpdate);

    await userEvent.click(screen.getByRole("radio", { name: "Brouillon" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Retirer Ada Lovelace du site pour 2026 ?");
    await userEvent.click(screen.getByRole("button", { name: "Retirer du site" }));

    expect(onUpdate).toHaveBeenCalledWith(1, { publicationStatus: "DRAFT" });
    expect(await screen.findByText("2026 : repassé en brouillon, retiré du site.")).toBeInTheDocument();
  });

  it("should keep a failure on screen", async () => {
    renderPanel(vi.fn().mockResolvedValue(false));

    await userEvent.click(screen.getByRole("radio", { name: "Brouillon" }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer du site" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("2026 : le statut n'a pas pu être changé.");
  });
});
