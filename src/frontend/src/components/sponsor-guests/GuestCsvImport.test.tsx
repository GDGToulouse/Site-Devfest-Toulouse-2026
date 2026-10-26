import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// jsdom's File has no arrayBuffer(): the bytes are not what is tested here.
vi.mock("@/lib/sponsor-guests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sponsor-guests")>()),
  fileToBase64: async () => "Tm9tO1Byw6lub20K",
}));

const { default: GuestCsvImport } = await import("./GuestCsvImport");

// #729 — the preview decides what the sponsor can do next: fix the listed
// lines, trim a batch past the places, or confirm.

function pick(content = "Nom;Prénom\n") {
  fireEvent.change(screen.getByLabelText("Fichier CSV des invités"), {
    target: { files: [new File([content], "invites.csv", { type: "text/csv" })] },
  });
}

const GUESTS = [
  { line: 2, lastName: "Martin", firstName: "Paul", email: "paul@example.org", hasDuplicateEmail: false },
  { line: 3, lastName: "Petit", firstName: "Zoé", email: "paul@example.org", hasDuplicateEmail: true },
];

describe("GuestCsvImport (#729)", () => {
  it("lists every faulty line the server reports", async () => {
    const runImport = vi.fn().mockResolvedValue({
      status: 422,
      failure: { error: "invalid_lines", lines: [{ line: 3, message: "genre « Robot » inconnu" }] },
    });
    render(<GuestCsvImport templateUrl="/t.csv" runImport={runImport} onImported={vi.fn()} />);

    pick();

    expect(await screen.findByText("Ligne 3 : genre « Robot » inconnu")).toBeInTheDocument();
  });

  it("refuses to import a batch past the places, saying by how much", async () => {
    const runImport = vi.fn().mockResolvedValue({ status: 200, preview: { count: 2, remaining: 1, excess: 1, guests: GUESTS } });
    render(<GuestCsvImport templateUrl="/t.csv" runImport={runImport} onImported={vi.fn()} />);

    pick();

    expect(await screen.findByText(/dépasse vos places de 1 ligne/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Importer/ })).not.toBeInTheDocument();
    expect(screen.getByText(/une seule recevra les billets/)).toBeInTheDocument();
  });

  it("imports on confirmation", async () => {
    const onImported = vi.fn();
    const runImport = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, preview: { count: 2, remaining: 5, excess: 0, guests: GUESTS } })
      .mockResolvedValueOnce({ status: 201 });
    render(<GuestCsvImport templateUrl="/t.csv" runImport={runImport} onImported={onImported} />);

    pick();
    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 personnes" }));

    await vi.waitFor(() => expect(onImported).toHaveBeenCalledWith(2));
    expect(runImport).toHaveBeenLastCalledWith(expect.any(String), true);
  });
});
