import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// TipTap does not run in jsdom; a textarea stands in so the test can type HTML.
vi.mock("@/components/admin/RichTextEditor", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const createSponsorJobOffer = vi.fn();
vi.mock("@/lib/sponsor-api", () => ({
  getSponsorJobOffers: async () => ({ data: { quota: 1, offers: [] }, status: 200 }),
  createSponsorJobOffer: (...args: unknown[]) => createSponsorJobOffer(...args),
  updateSponsorJobOffer: vi.fn(),
  deleteSponsorJobOffer: vi.fn(),
}));

const { default: JobOffersTab } = await import("./JobOffersTab");

// The SFEIR offer of #610: under 5 000 visible characters, over once the
// editor wraps each bullet in <li><p>…</p></li>.
const PASTED_FROM_LEVER = `<ul>${"<li><p>Concevoir des architectures cloud robustes.</p></li>".repeat(100)}</ul>`;

async function fillOffer(description: string) {
  render(<JobOffersTab sponsorId={15} canEdit />);
  fireEvent.change(await screen.findByLabelText("Intitulé du poste"), {
    target: { value: "Architecte Cloud (F/H/NB)" },
  });
  fireEvent.change(screen.getByLabelText("Lien vers l'offre"), {
    target: { value: "https://jobs.lever.co/sfeir/1" },
  });
  fireEvent.change(screen.getByLabelText("Description (français)"), { target: { value: description } });
}

describe("JobOffersTab — description length (#610)", () => {
  beforeEach(() => createSponsorJobOffer.mockReset());

  it("shows the gauge in error and blocks the send before reaching the server", async () => {
    await fillOffer(PASTED_FROM_LEVER);

    expect(screen.getByText(/Description trop longue/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La description en français est trop longue");
    expect(createSponsorJobOffer).not.toHaveBeenCalled();
  });

  it("names the field when the server refuses it, instead of asking to retry", async () => {
    createSponsorJobOffer.mockResolvedValue({
      data: null,
      status: 400,
      error: "Bad Request",
      code: "FST_ERR_VALIDATION",
      message: "body/descriptionEn must NOT have more than 5000 characters",
    });
    await fillOffer("<p>Courte</p>");

    fireEvent.click(screen.getByRole("button", { name: "Publier" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La description en anglais est trop longue");
    expect(alert).not.toHaveTextContent("Réessayez");
  });

  it("still publishes a description under the limit", async () => {
    createSponsorJobOffer.mockResolvedValue({ data: { id: 1 }, status: 201 });
    await fillOffer("<p>Courte</p>");

    fireEvent.click(screen.getByRole("button", { name: "Publier" }));

    await waitFor(() => expect(createSponsorJobOffer).toHaveBeenCalledTimes(1));
  });
});
