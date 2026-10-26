import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { SponsorGuests } from "@/lib/sponsor-api";

// #728 — what a sponsor may do with its guests depends on the registration
// state and on each guest's ticket. The API refuses the rest; this pins what
// the screen offers, so a sponsor is not handed a button that can only fail.

const getSponsorGuests = vi.fn();
const createSponsorGuest = vi.fn();
vi.mock("@/lib/sponsor-api", () => ({
  getSponsorGuests: (...args: unknown[]) => getSponsorGuests(...args),
  createSponsorGuest: (...args: unknown[]) => createSponsorGuest(...args),
  updateSponsorGuest: vi.fn(),
  deleteSponsorGuest: vi.fn(),
  importSponsorGuests: vi.fn(),
  inviteTeamMember: vi.fn(),
  sponsorGuestTemplateUrl: (id: number) => `/api/sponsor-space/${id}/guests/template`,
}));

const { default: GuestsTab } = await import("./GuestsTab");

const GUEST = {
  id: 1,
  lastName: "Garcia",
  firstName: "Inès",
  email: "ines@example.org",
  gender: "FEMALE" as const,
  experience: "OVER_7_YEARS" as const,
  attendsAfterParty: true,
  diet: "VEGAN" as const,
  needsAssistance: false,
  rank: 1,
  isWithinQuota: true,
  hasDuplicateEmail: false,
  hasTicket: false,
  isTicketCancelled: false,
};

function state(overrides: Partial<SponsorGuests> = {}): SponsorGuests {
  return {
    registration: {
      isOpen: true,
      hasEverOpened: true,
      deadline: "2099-11-13T22:59:00.000Z",
      isPastDeadline: false,
      canWrite: true,
    },
    quota: 2,
    registeredCount: 1,
    remaining: 1,
    outOfQuotaCount: 0,
    guests: [GUEST],
    ...overrides,
  };
}

describe("GuestsTab (#728)", () => {
  beforeEach(() => {
    getSponsorGuests.mockReset();
    createSponsorGuest.mockReset();
  });

  it("shows the places and the deadline, and lets an editor correct a guest without a ticket", async () => {
    getSponsorGuests.mockResolvedValue({ data: state(), status: 200 });

    render(<GuestsTab sponsorId={1} canManageTeam={false} />);

    expect(await screen.findByText(/Inscriptions ouvertes jusqu'au vendredi 13 novembre à 23:59/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Modifier/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inscrire" })).toBeInTheDocument();
  });

  it("locks a guest whose ticket was sent and says how to correct it", async () => {
    getSponsorGuests.mockResolvedValue({ data: state({ guests: [{ ...GUEST, hasTicket: true }] }), status: 200 });

    render(<GuestsTab sponsorId={1} canManageTeam={false} />);

    expect(await screen.findByText(/le lien en bas de l'e-mail de son billet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Modifier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirer/ })).not.toBeInTheDocument();
  });

  it("offers nothing to write once registration is closed", async () => {
    getSponsorGuests.mockResolvedValue({
      data: state({ registration: { ...state().registration, isOpen: false, canWrite: false } }),
      status: 200,
    });

    render(<GuestsTab sponsorId={1} canManageTeam={false} />);

    expect(await screen.findByText(/Les inscriptions sont closes/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inscrire" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fichier CSV des invités")).not.toBeInTheDocument();
  });

  it("warns about guests out of quota", async () => {
    getSponsorGuests.mockResolvedValue({
      data: state({ outOfQuotaCount: 1, remaining: 0, guests: [GUEST, { ...GUEST, id: 2, rank: 3, isWithinQuota: false }] }),
      status: 200,
    });

    render(<GuestsTab sponsorId={1} canManageTeam={false} />);

    expect(await screen.findByText(/1 inscrit dépasse vos places/)).toBeInTheDocument();
    expect(screen.getByText("Hors quota")).toBeInTheDocument();
    expect(screen.getByText(/Toutes vos places sont prises/)).toBeInTheDocument();
  });

  it("checks the form before sending it", async () => {
    getSponsorGuests.mockResolvedValue({ data: state(), status: 200 });

    render(<GuestsTab sponsorId={1} canManageTeam={false} />);
    fireEvent.change(await screen.findByLabelText("Nom"), { target: { value: "Martin" } });
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Paul" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "paul@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Inscrire" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choisissez le genre.");
    expect(createSponsorGuest).not.toHaveBeenCalled();
  });

  it("sends a complete guest", async () => {
    getSponsorGuests.mockResolvedValue({ data: state(), status: 200 });
    createSponsorGuest.mockResolvedValue({ data: { id: 9 }, status: 201 });

    render(<GuestsTab sponsorId={7} canManageTeam={false} />);
    fireEvent.change(await screen.findByLabelText("Nom"), { target: { value: "Martin" } });
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Paul" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "paul@example.org" } });
    fireEvent.click(screen.getByLabelText("Homme"));
    fireEvent.change(screen.getByLabelText("Expérience professionnelle"), { target: { value: "STUDENT" } });
    fireEvent.click(screen.getByRole("button", { name: "Inscrire" }));

    await waitFor(() =>
      expect(createSponsorGuest).toHaveBeenCalledWith(7, expect.objectContaining({ lastName: "Martin", gender: "MALE", experience: "STUDENT" })),
    );
    expect(await screen.findByText("Paul Martin est inscrit·e.")).toBeInTheDocument();
  });
});
